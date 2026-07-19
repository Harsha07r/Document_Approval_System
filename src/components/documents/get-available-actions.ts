import type { SerializedDocument } from "@/lib/api-types";
import type { DocumentStatus, SessionUser } from "@/types";

export type DocumentActionName =
  | "EDIT"
  | "SUBMIT"
  | "APPROVE"
  | "REJECT"
  | "PUBLISH"
  | "ARCHIVE"
  | "REVERT_TO_DRAFT";

/**
 * UX-only convenience that mirrors the server's authoritative rules
 * (rbac.ts's permission matrix + ownership check, workflow.ts's transition
 * table) so the right buttons appear without an extra round trip. Every
 * one of these conditions is re-validated independently by the API on each
 * request — nothing here is a security boundary, only a rendering decision.
 */
export function getAvailableActions(
  user: SessionUser,
  document: SerializedDocument,
): DocumentActionName[] {
  if (user.role === "VIEWER") {
    return [];
  }

  const isOwner = document.authorId === user.id;
  const isAdmin = user.role === "ADMIN";
  const canReachStatus = (status: DocumentStatus) => document.allowedNextStatuses.includes(status);

  const authorOrAdmin = isAdmin || (user.role === "AUTHOR" && isOwner);
  const reviewerOrAdmin = isAdmin || user.role === "REVIEWER";
  const reviewerNotOwnerOrAdmin = isAdmin || (user.role === "REVIEWER" && !isOwner);

  const actions: DocumentActionName[] = [];

  if (document.status === "DRAFT" && authorOrAdmin) {
    actions.push("EDIT");
    if (canReachStatus("SUBMITTED")) {
      actions.push("SUBMIT");
    }
  }

  if (document.status === "SUBMITTED" && reviewerNotOwnerOrAdmin) {
    if (canReachStatus("APPROVED")) {
      actions.push("APPROVE");
    }
    if (canReachStatus("REJECTED")) {
      actions.push("REJECT");
    }
  }

  if (document.status === "APPROVED" && reviewerOrAdmin && canReachStatus("PUBLISHED")) {
    actions.push("PUBLISH");
  }

  if (document.status === "REJECTED" && authorOrAdmin && canReachStatus("DRAFT")) {
    actions.push("REVERT_TO_DRAFT");
  }

  if (isAdmin && canReachStatus("ARCHIVED")) {
    actions.push("ARCHIVE");
  }

  return actions;
}
