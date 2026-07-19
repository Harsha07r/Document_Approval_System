import { describe, expect, it } from "vitest";

import { assertTransition, canTransition, getAllowedNextStatuses } from "@/server/documents/workflow";
import { InvalidTransitionError } from "@/server/shared/errors";
import type { DocumentStatus } from "@/types";

const ALL_STATUSES: readonly DocumentStatus[] = [
  "DRAFT",
  "SUBMITTED",
  "APPROVED",
  "REJECTED",
  "PUBLISHED",
  "ARCHIVED",
];

/**
 * The independently-defined expected adjacency list from the assignment
 * spec. Deliberately re-declared here (not imported from workflow.ts) so
 * the test actually verifies the implementation against the spec, rather
 * than trivially asserting the implementation agrees with itself.
 */
const EXPECTED_TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["APPROVED", "REJECTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  REJECTED: ["DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

describe("workflow state machine", () => {
  for (const from of ALL_STATUSES) {
    for (const to of ALL_STATUSES) {
      const shouldBeValid = EXPECTED_TRANSITIONS[from].includes(to);

      it(`${shouldBeValid ? "allows" : "rejects"} ${from} -> ${to}`, () => {
        expect(canTransition(from, to)).toBe(shouldBeValid);

        if (shouldBeValid) {
          expect(() => assertTransition(from, to)).not.toThrow();
        } else {
          expect(() => assertTransition(from, to)).toThrow(InvalidTransitionError);
        }
      });
    }
  }

  it("exposes the same allowed set via getAllowedNextStatuses", () => {
    for (const from of ALL_STATUSES) {
      expect(getAllowedNextStatuses(from)).toEqual(EXPECTED_TRANSITIONS[from]);
    }
  });

  it("ARCHIVED is a terminal status with no outgoing transitions", () => {
    expect(getAllowedNextStatuses("ARCHIVED")).toEqual([]);
    for (const to of ALL_STATUSES) {
      expect(canTransition("ARCHIVED", to)).toBe(false);
    }
  });

  it("InvalidTransitionError reports the attempted from/to statuses", () => {
    try {
      assertTransition("ARCHIVED", "DRAFT");
      expect.unreachable("assertTransition should have thrown");
    } catch (error) {
      expect(error).toBeInstanceOf(InvalidTransitionError);
      expect((error as InvalidTransitionError).message).toContain("ARCHIVED");
      expect((error as InvalidTransitionError).message).toContain("DRAFT");
      expect((error as InvalidTransitionError).statusCode).toBe(409);
    }
  });
});
