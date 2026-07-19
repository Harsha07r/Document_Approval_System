import { prisma } from "@/lib/prisma";
import { getCurrentUserOrThrow } from "@/server/auth/session";
import { assertPermission, type Action } from "@/server/auth/rbac";
import { recordAuditLog } from "@/server/audit/auditLogger";
import { ConflictError, ForbiddenError } from "@/server/shared/errors";
import * as documentRepository from "@/server/documents/repository";
import { assertTransition, getAllowedNextStatuses } from "@/server/documents/workflow";
import type {
  ApproveInput,
  ArchiveInput,
  CreateDocumentInput,
  PublishInput,
  RejectInput,
  RevertToDraftInput,
  SubmitInput,
  UpdateDocumentInput,
} from "@/server/documents/schemas";
import type { AuditAction, Document, DocumentStatus, SessionUser } from "@/types";

/**
 * The shape returned to route handlers/clients. Kept as an explicit type
 * (rather than returning the raw Prisma `Document`) so the service boundary
 * is free to add computed, read-only fields — like `allowedNextStatuses` —
 * without that leaking into or being confused with persisted columns.
 */
export interface DocumentDTO {
  id: string;
  title: string;
  content: string;
  status: DocumentStatus;
  version: number;
  authorId: string;
  createdAt: Date;
  updatedAt: Date;
  allowedNextStatuses: readonly DocumentStatus[];
}

function toDocumentDTO(document: Document): DocumentDTO {
  return {
    id: document.id,
    title: document.title,
    content: document.content,
    status: document.status,
    version: document.version,
    authorId: document.authorId,
    createdAt: document.createdAt,
    updatedAt: document.updatedAt,
    allowedNextStatuses: getAllowedNextStatuses(document.status),
  };
}

/**
 * Defense-in-depth rule that sits outside the static role/ownership matrix
 * in rbac.ts: a REVIEWER may never approve or reject a document they
 * themselves authored. Under the current CREATE permissions (AUTHOR,
 * ADMIN only) a REVIEWER can never actually become a document's author
 * through normal service flows, but the check costs nothing and removes
 * any dependency on that invariant holding forever.
 */
function assertNotSelfReview(actor: SessionUser, document: Document): void {
  if (actor.role === "REVIEWER" && document.authorId === actor.id) {
    throw new ForbiddenError("Reviewers cannot approve or reject their own document.");
  }
}

/**
 * Visibility rule layered on top of the coarse VIEW permission: a VIEWER
 * may see the existence and content of PUBLISHED documents only. This is a
 * resource-state check, not a role/ownership check, so it belongs here
 * rather than in the static rbac.ts matrix.
 */
function assertViewerCanSeeStatus(actor: SessionUser, status: DocumentStatus): void {
  if (actor.role === "VIEWER" && status !== "PUBLISHED") {
    throw new ForbiddenError("Viewers may only view published documents.");
  }
}

export async function createDocument(input: CreateDocumentInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  assertPermission(actor, "CREATE");

  const created = await prisma.$transaction(async (tx) => {
    const document = await documentRepository.create(tx, {
      title: input.title,
      content: input.content,
      authorId: actor.id,
    });

    await recordAuditLog(tx, {
      documentId: document.id,
      actorId: actor.id,
      action: "CREATE",
      fromStatus: null,
      toStatus: document.status,
    });

    return document;
  });

  return toDocumentDTO(created);
}

/**
 * Edits title/content on a DRAFT document. This is not a workflow
 * transition (status is unchanged), so it is not part of the AuditAction
 * enum and does not produce an audit log entry — and since
 * `repository.update` is already a single atomic compare-and-swap
 * statement, it does not need an explicit `$transaction` wrapper the way
 * the paired transition+audit writes below do.
 */
export async function updateDocument(documentId: string, input: UpdateDocumentInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  const document = await documentRepository.findByIdOrThrow(prisma, documentId);

  assertPermission(actor, "UPDATE", document.authorId);

  if (document.status !== "DRAFT") {
    throw new ConflictError(
      `Documents can only be edited while in DRAFT status (current status: ${document.status}).`,
    );
  }

  const updated = await documentRepository.update(prisma, {
    id: documentId,
    expectedVersion: input.version,
    data: {
      title: input.title,
      content: input.content,
    },
  });

  return toDocumentDTO(updated);
}

interface TransitionOptions {
  documentId: string;
  expectedVersion: number;
  action: Action;
  auditAction: AuditAction;
  toStatus: DocumentStatus;
  metadata?: Record<string, unknown>;
  additionalCheck?: (actor: SessionUser, document: Document) => void;
}

/**
 * Shared orchestration for every workflow-transition use case (submit,
 * approve, reject, publish, archive, revert-to-draft). Centralizing this
 * here means the permission check, transition validation, and the
 * transition+audit transaction are implemented exactly once, instead of
 * being re-derived six times with the risk of one call site drifting from
 * the others.
 */
async function performTransition(actor: SessionUser, options: TransitionOptions): Promise<DocumentDTO> {
  const document = await documentRepository.findByIdOrThrow(prisma, options.documentId);

  assertPermission(actor, options.action, document.authorId);
  options.additionalCheck?.(actor, document);
  assertTransition(document.status, options.toStatus);

  const result = await prisma.$transaction(async (tx) => {
    const updated = await documentRepository.transition(tx, {
      id: options.documentId,
      fromStatus: document.status,
      toStatus: options.toStatus,
      expectedVersion: options.expectedVersion,
    });

    await recordAuditLog(tx, {
      documentId: updated.id,
      actorId: actor.id,
      action: options.auditAction,
      fromStatus: document.status,
      toStatus: options.toStatus,
      metadata: options.metadata,
    });

    return updated;
  });

  return toDocumentDTO(result);
}

export async function submitDocument(documentId: string, input: SubmitInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "SUBMIT",
    auditAction: "SUBMIT",
    toStatus: "SUBMITTED",
  });
}

export async function approveDocument(documentId: string, input: ApproveInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "APPROVE",
    auditAction: "APPROVE",
    toStatus: "APPROVED",
    additionalCheck: assertNotSelfReview,
  });
}

export async function rejectDocument(documentId: string, input: RejectInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "REJECT",
    auditAction: "REJECT",
    toStatus: "REJECTED",
    metadata: { reason: input.reason },
    additionalCheck: assertNotSelfReview,
  });
}

export async function publishDocument(documentId: string, input: PublishInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "PUBLISH",
    auditAction: "PUBLISH",
    toStatus: "PUBLISHED",
  });
}

export async function archiveDocument(documentId: string, input: ArchiveInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "ARCHIVE",
    auditAction: "ARCHIVE",
    toStatus: "ARCHIVED",
  });
}

export async function revertToDraft(documentId: string, input: RevertToDraftInput): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  return performTransition(actor, {
    documentId,
    expectedVersion: input.version,
    action: "REVERT_TO_DRAFT",
    auditAction: "REVERT_TO_DRAFT",
    toStatus: "DRAFT",
  });
}

export async function getDocument(documentId: string): Promise<DocumentDTO> {
  const actor = await getCurrentUserOrThrow();
  assertPermission(actor, "VIEW");

  const document = await documentRepository.findByIdOrThrow(prisma, documentId);
  assertViewerCanSeeStatus(actor, document.status);

  return toDocumentDTO(document);
}

/**
 * List scoping beyond the coarse VIEW permission: VIEWERs only ever see
 * PUBLISHED documents; AUTHORs see only documents they authored (the
 * "my documents" model implied by "edit own draft" / "submit own"
 * elsewhere in the spec); REVIEWER and ADMIN see everything, since
 * reviewing requires visibility into any submitted document.
 */
export async function listDocuments(): Promise<DocumentDTO[]> {
  const actor = await getCurrentUserOrThrow();
  assertPermission(actor, "VIEW");

  const documents = await documentRepository.findMany(prisma);

  const visible = documents.filter((document) => {
    if (actor.role === "VIEWER") {
      return document.status === "PUBLISHED";
    }
    if (actor.role === "AUTHOR") {
      return document.authorId === actor.id;
    }
    return true;
  });

  return visible.map(toDocumentDTO);
}
