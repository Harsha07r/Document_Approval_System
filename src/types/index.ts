import type { Role } from "@prisma/client";

export type { Role, DocumentStatus, AuditAction, Document, User, Session, AuditLog } from "@prisma/client";

/**
 * The authenticated user shape carried through the request lifecycle.
 * Deliberately narrower than the Prisma `User` model so nothing beyond
 * what authorization decisions need ever flows past the session layer.
 */
export interface SessionUser {
  id: string;
  email: string;
  name: string;
  role: Role;
}
