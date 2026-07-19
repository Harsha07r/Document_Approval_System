import { describe, expect, it } from "vitest";

import { getAvailableActions } from "@/components/documents/get-available-actions";
import type { SerializedDocument } from "@/lib/api-types";
import type { DocumentStatus, Role, SessionUser } from "@/types";

function makeUser(role: Role, id: string): SessionUser {
  return { id, email: `${role.toLowerCase()}@example.com`, name: role, role };
}

const ALLOWED_NEXT: Record<DocumentStatus, DocumentStatus[]> = {
  DRAFT: ["SUBMITTED", "ARCHIVED"],
  SUBMITTED: ["APPROVED", "REJECTED", "ARCHIVED"],
  APPROVED: ["PUBLISHED", "ARCHIVED"],
  REJECTED: ["DRAFT"],
  PUBLISHED: ["ARCHIVED"],
  ARCHIVED: [],
};

function makeDocument(status: DocumentStatus, authorId: string): SerializedDocument {
  return {
    id: "doc-1",
    title: "Title",
    content: "Body",
    status,
    version: 1,
    authorId,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    allowedNextStatuses: ALLOWED_NEXT[status],
  };
}

describe("getAvailableActions", () => {
  it("gives VIEWER no actions regardless of status", () => {
    const viewer = makeUser("VIEWER", "viewer-1");
    for (const status of Object.keys(ALLOWED_NEXT) as DocumentStatus[]) {
      expect(getAvailableActions(viewer, makeDocument(status, "author-1"))).toEqual([]);
    }
  });

  it("gives an owning AUTHOR Edit + Submit on a Draft document", () => {
    const author = makeUser("AUTHOR", "author-1");
    const actions = getAvailableActions(author, makeDocument("DRAFT", "author-1"));
    expect(actions).toEqual(["EDIT", "SUBMIT"]);
  });

  it("gives a non-owning AUTHOR no actions on someone else's Draft", () => {
    const author = makeUser("AUTHOR", "author-1");
    const actions = getAvailableActions(author, makeDocument("DRAFT", "someone-else"));
    expect(actions).toEqual([]);
  });

  it("gives an owning AUTHOR only Revert-to-Draft on a Rejected document", () => {
    const author = makeUser("AUTHOR", "author-1");
    const actions = getAvailableActions(author, makeDocument("REJECTED", "author-1"));
    expect(actions).toEqual(["REVERT_TO_DRAFT"]);
  });

  it("gives a REVIEWER Approve + Reject on a Submitted document they don't own", () => {
    const reviewer = makeUser("REVIEWER", "reviewer-1");
    const actions = getAvailableActions(reviewer, makeDocument("SUBMITTED", "author-1"));
    expect(actions).toEqual(["APPROVE", "REJECT"]);
  });

  it("hides Approve/Reject from a REVIEWER on their own document (self-review)", () => {
    const reviewer = makeUser("REVIEWER", "reviewer-1");
    const actions = getAvailableActions(reviewer, makeDocument("SUBMITTED", "reviewer-1"));
    expect(actions).toEqual([]);
  });

  it("gives a REVIEWER Publish on an Approved document", () => {
    const reviewer = makeUser("REVIEWER", "reviewer-1");
    const actions = getAvailableActions(reviewer, makeDocument("APPROVED", "author-1"));
    expect(actions).toEqual(["PUBLISH"]);
  });

  it("never gives AUTHOR Approve, Reject, Publish, or Archive", () => {
    const author = makeUser("AUTHOR", "author-1");
    expect(getAvailableActions(author, makeDocument("SUBMITTED", "author-1"))).toEqual([]);
    expect(getAvailableActions(author, makeDocument("APPROVED", "author-1"))).toEqual([]);
    expect(getAvailableActions(author, makeDocument("PUBLISHED", "author-1"))).toEqual([]);
  });

  it("gives ADMIN Edit + Submit + Archive on a Draft document (no ownership restriction)", () => {
    const admin = makeUser("ADMIN", "admin-1");
    const actions = getAvailableActions(admin, makeDocument("DRAFT", "someone-else"));
    expect(actions).toEqual(["EDIT", "SUBMIT", "ARCHIVE"]);
  });

  it("gives ADMIN Approve + Reject + Archive on a Submitted document, even one they authored", () => {
    const admin = makeUser("ADMIN", "admin-1");
    const actions = getAvailableActions(admin, makeDocument("SUBMITTED", "admin-1"));
    expect(actions).toEqual(["APPROVE", "REJECT", "ARCHIVE"]);
  });

  it("gives ADMIN only Archive on a Published document", () => {
    const admin = makeUser("ADMIN", "admin-1");
    const actions = getAvailableActions(admin, makeDocument("PUBLISHED", "author-1"));
    expect(actions).toEqual(["ARCHIVE"]);
  });

  it("gives ADMIN no actions on a terminal Archived document", () => {
    const admin = makeUser("ADMIN", "admin-1");
    const actions = getAvailableActions(admin, makeDocument("ARCHIVED", "author-1"));
    expect(actions).toEqual([]);
  });
});
