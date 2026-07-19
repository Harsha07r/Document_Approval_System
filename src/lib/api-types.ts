import type { AuditAction, DocumentStatus, Role } from "@/types";
import type { DocumentDTO } from "@/server/documents/service";

export interface UserSummary {
  id: string;
  name: string;
  email: string;
  role: Role;
}

/**
 * What `DocumentDTO` actually looks like once it has crossed a JSON HTTP
 * response: `Date` fields arrive as ISO strings, not `Date` instances.
 * Using `DocumentDTO` itself on the client would silently lie about that.
 */
export type SerializedDocument = Omit<DocumentDTO, "createdAt" | "updatedAt"> & {
  createdAt: string;
  updatedAt: string;
};

export interface AuditLogEntryDTO {
  id: string;
  action: AuditAction;
  fromStatus: DocumentStatus | null;
  toStatus: DocumentStatus;
  createdAt: string;
  metadata: { reason?: string } | null;
  actor: UserSummary;
}
