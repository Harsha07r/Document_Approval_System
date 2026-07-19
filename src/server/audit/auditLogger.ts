import type { Prisma } from "@prisma/client";

import * as documentRepository from "@/server/documents/repository";
import type { DbClient } from "@/server/documents/repository";
import type { AuditAction, DocumentStatus } from "@/types";

export interface AuditLogInput {
  documentId: string;
  actorId: string;
  action: AuditAction;
  toStatus: DocumentStatus;
  fromStatus?: DocumentStatus | null;
  metadata?: Record<string, unknown>;
}

/**
 * The single call site used to persist an audit trail entry. Callers pass
 * the same transaction client used for the state-changing write so the
 * write and its audit entry commit or roll back together, satisfying the
 * "audit log in the same transaction" requirement structurally rather than
 * by convention.
 */
export async function recordAuditLog(db: DbClient, input: AuditLogInput) {
  return documentRepository.createAuditLog(db, {
    documentId: input.documentId,
    actorId: input.actorId,
    action: input.action,
    fromStatus: input.fromStatus ?? null,
    toStatus: input.toStatus,
    metadata: input.metadata as Prisma.InputJsonValue | undefined,
  });
}
