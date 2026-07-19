import type { Role, SessionUser } from "@/types";
import { ForbiddenError } from "@/server/shared/errors";

/**
 * Permission-checking actions. This is intentionally broader than the
 * Prisma `AuditAction` enum: VIEW and UPDATE are authorization concerns
 * that never produce an audit trail entry, because they don't change a
 * document's workflow status.
 */
export type Action =
  | "CREATE"
  | "VIEW"
  | "UPDATE"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "REVERT_TO_DRAFT"
  | "PUBLISH"
  | "ARCHIVE";

const PERMISSIONS: Record<Action, readonly Role[]> = {
  CREATE: ["AUTHOR", "ADMIN"],
  VIEW: ["AUTHOR", "REVIEWER", "ADMIN", "VIEWER"],
  UPDATE: ["AUTHOR", "ADMIN"],
  SUBMIT: ["AUTHOR", "ADMIN"],
  APPROVE: ["REVIEWER", "ADMIN"],
  REJECT: ["REVIEWER", "ADMIN"],
  REVERT_TO_DRAFT: ["AUTHOR", "ADMIN"],
  PUBLISH: ["REVIEWER", "ADMIN"],
  ARCHIVE: ["ADMIN"],
};

/**
 * Actions where an AUTHOR is only permitted to act on documents they
 * themselves authored. ADMIN is exempt from ownership checks entirely.
 */
const OWNERSHIP_REQUIRED_ACTIONS: ReadonlySet<Action> = new Set(["UPDATE", "SUBMIT", "REVERT_TO_DRAFT"]);

/**
 * Throws ForbiddenError unless `user` is permitted to perform `action`.
 * `resourceOwnerId` must be supplied for any action in
 * OWNERSHIP_REQUIRED_ACTIONS when the caller's role is AUTHOR.
 */
export function assertPermission(user: SessionUser, action: Action, resourceOwnerId?: string): void {
  const allowedRoles = PERMISSIONS[action];

  if (!allowedRoles.includes(user.role)) {
    throw new ForbiddenError(`Role ${user.role} is not permitted to perform ${action}.`);
  }

  if (user.role === "AUTHOR" && OWNERSHIP_REQUIRED_ACTIONS.has(action)) {
    if (resourceOwnerId === undefined) {
      throw new ForbiddenError(`Ownership could not be verified for action ${action}.`);
    }
    if (resourceOwnerId !== user.id) {
      throw new ForbiddenError(`Authors may only perform ${action} on their own documents.`);
    }
  }
}
