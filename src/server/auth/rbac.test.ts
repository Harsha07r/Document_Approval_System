import { describe, expect, it } from "vitest";

import { assertPermission, type Action } from "@/server/auth/rbac";
import { ForbiddenError } from "@/server/shared/errors";
import type { Role, SessionUser } from "@/types";

function makeUser(role: Role, id = "user-1"): SessionUser {
  return { id, email: `${role.toLowerCase()}@example.com`, name: role, role };
}

const ALL_ROLES: readonly Role[] = ["AUTHOR", "REVIEWER", "ADMIN", "VIEWER"];

/**
 * Independently re-declared expected policy (not imported from rbac.ts),
 * matching the assignment's authorization rules: Author can create/edit
 * own drafts/submit own; Reviewer can approve/reject/publish; Admin can do
 * everything including archive; Viewer is read-only.
 */
const EXPECTED_PERMISSIONS: Record<Action, readonly Role[]> = {
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

const OWNERSHIP_REQUIRED_ACTIONS: readonly Action[] = ["UPDATE", "SUBMIT", "REVERT_TO_DRAFT"];

describe("assertPermission — role matrix", () => {
  for (const action of Object.keys(EXPECTED_PERMISSIONS) as Action[]) {
    for (const role of ALL_ROLES) {
      const allowed = EXPECTED_PERMISSIONS[action].includes(role);

      it(`${allowed ? "allows" : "denies"} ${role} to ${action}`, () => {
        const user = makeUser(role);
        // Supply a matching resourceOwnerId for ownership-gated actions so
        // this test isolates the role check, not incidentally failing on
        // an unrelated ownership mismatch.
        const resourceOwnerId = OWNERSHIP_REQUIRED_ACTIONS.includes(action) ? user.id : undefined;

        if (allowed) {
          expect(() => assertPermission(user, action, resourceOwnerId)).not.toThrow();
        } else {
          expect(() => assertPermission(user, action, resourceOwnerId)).toThrow(ForbiddenError);
        }
      });
    }
  }
});

describe("assertPermission — ownership", () => {
  it("allows an AUTHOR to UPDATE their own document", () => {
    const user = makeUser("AUTHOR", "author-1");
    expect(() => assertPermission(user, "UPDATE", "author-1")).not.toThrow();
  });

  it("denies an AUTHOR from UPDATING someone else's document", () => {
    const user = makeUser("AUTHOR", "author-1");
    expect(() => assertPermission(user, "UPDATE", "someone-else")).toThrow(ForbiddenError);
  });

  it("denies an AUTHOR from SUBMITTING someone else's document", () => {
    const user = makeUser("AUTHOR", "author-1");
    expect(() => assertPermission(user, "SUBMIT", "someone-else")).toThrow(ForbiddenError);
  });

  it("denies an AUTHOR from reverting someone else's document to draft", () => {
    const user = makeUser("AUTHOR", "author-1");
    expect(() => assertPermission(user, "REVERT_TO_DRAFT", "someone-else")).toThrow(ForbiddenError);
  });

  it("denies an AUTHOR action entirely when no resourceOwnerId is supplied", () => {
    const user = makeUser("AUTHOR", "author-1");
    expect(() => assertPermission(user, "UPDATE")).toThrow(ForbiddenError);
  });

  it("lets ADMIN bypass ownership checks entirely", () => {
    const user = makeUser("ADMIN", "admin-1");
    expect(() => assertPermission(user, "UPDATE", "someone-else")).not.toThrow();
    expect(() => assertPermission(user, "SUBMIT", "someone-else")).not.toThrow();
    expect(() => assertPermission(user, "REVERT_TO_DRAFT", "someone-else")).not.toThrow();
  });

  it("does not apply ownership checks to REVIEWER/ADMIN-only actions", () => {
    const reviewer = makeUser("REVIEWER", "reviewer-1");
    expect(() => assertPermission(reviewer, "APPROVE", "someone-else")).not.toThrow();
    expect(() => assertPermission(reviewer, "PUBLISH", "someone-else")).not.toThrow();
  });
});
