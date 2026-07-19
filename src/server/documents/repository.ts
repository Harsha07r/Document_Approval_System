import type { Prisma } from "@prisma/client";

import { prisma } from "@/lib/prisma";
import { ConflictError, NotFoundError } from "@/server/shared/errors";
import type { AuditAction, Document, DocumentStatus } from "@/types";

/**
 * Every function here accepts either the top-level PrismaClient or an
 * interactive transaction client, so callers can compose reads/writes
 * inside a single `prisma.$transaction` without the repository knowing or
 * caring which one it received.
 */
export type DbClient = Prisma.TransactionClient | typeof prisma;

export async function findById(db: DbClient, id: string): Promise<Document | null> {
  return db.document.findUnique({ where: { id } });
}

export async function findByIdOrThrow(db: DbClient, id: string): Promise<Document> {
  const document = await findById(db, id);
  if (!document) {
    throw new NotFoundError("Document", id);
  }
  return document;
}

export async function findMany(db: DbClient): Promise<Document[]> {
  return db.document.findMany({ orderBy: { updatedAt: "desc" } });
}

export async function create(
  db: DbClient,
  data: { title: string; content: string; authorId: string },
): Promise<Document> {
  return db.document.create({
    data: {
      title: data.title,
      content: data.content,
      authorId: data.authorId,
      status: "DRAFT",
      version: 1,
    },
  });
}

/**
 * Updates title/content on a document without changing its workflow
 * status. Guarded by the same optimistic-concurrency compare-and-swap as
 * `transition`: the WHERE clause only matches the row if its version still
 * equals what the caller last read.
 */
export async function update(
  db: DbClient,
  params: { id: string; expectedVersion: number; data: { title?: string; content?: string } },
): Promise<Document> {
  const result = await db.document.updateMany({
    where: { id: params.id, version: params.expectedVersion },
    data: { ...params.data, version: { increment: 1 } },
  });

  if (result.count === 0) {
    throw new ConflictError("The document was modified by another request. Reload and try again.");
  }

  return findByIdOrThrow(db, params.id);
}

/**
 * Atomically moves a document from `fromStatus` to `toStatus` only if its
 * version and status both still match what the caller expects. A
 * `result.count` of 0 means either a concurrent write already changed the
 * row (stale version) or the state changed under the caller — both are
 * surfaced identically as a conflict, since the caller must re-fetch and
 * re-evaluate either way.
 */
export async function transition(
  db: DbClient,
  params: { id: string; fromStatus: DocumentStatus; toStatus: DocumentStatus; expectedVersion: number },
): Promise<Document> {
  const result = await db.document.updateMany({
    where: { id: params.id, version: params.expectedVersion, status: params.fromStatus },
    data: { status: params.toStatus, version: { increment: 1 } },
  });

  if (result.count === 0) {
    throw new ConflictError(
      "The document could not be transitioned because it was modified by another request.",
    );
  }

  return findByIdOrThrow(db, params.id);
}

export async function createAuditLog(
  db: DbClient,
  data: {
    documentId: string;
    actorId: string;
    action: AuditAction;
    fromStatus: DocumentStatus | null;
    toStatus: DocumentStatus;
    metadata?: Prisma.InputJsonValue;
  },
) {
  return db.auditLog.create({
    data: {
      documentId: data.documentId,
      actorId: data.actorId,
      action: data.action,
      fromStatus: data.fromStatus,
      toStatus: data.toStatus,
      metadata: data.metadata,
    },
  });
}
