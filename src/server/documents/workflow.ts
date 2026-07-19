import type { DocumentStatus } from "@/types";
import { InvalidTransitionError } from "@/server/shared/errors";

/**
 * The single source of truth for which DocumentStatus transitions are
 * legal. Every state-changing use case must call assertTransition before
 * writing, so an invalid transition is rejected identically regardless of
 * which endpoint attempted it.
 */
const TRANSITIONS: Record<DocumentStatus, readonly DocumentStatus[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["APPROVED", "REJECTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  REJECTED: ["DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

export function canTransition(from: DocumentStatus, to: DocumentStatus): boolean {
  return TRANSITIONS[from].includes(to);
}

export function assertTransition(from: DocumentStatus, to: DocumentStatus): void {
  if (!canTransition(from, to)) {
    throw new InvalidTransitionError(from, to);
  }
}

export function getAllowedNextStatuses(from: DocumentStatus): readonly DocumentStatus[] {
  return TRANSITIONS[from];
}
