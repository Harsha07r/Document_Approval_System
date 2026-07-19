import { beforeEach, describe, expect, it, vi } from "vitest";

import type { Document, Role, SessionUser } from "@/types";

const { mockPrisma, mockGetCurrentUserOrThrow } = vi.hoisted(() => {
  const prisma = {
    document: {
      findUnique: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      updateMany: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  };

  // The transaction client is the same mock object: repository functions
  // only ever call `.document.*`/`.auditLog.*`, so a single mock
  // satisfies both the top-level PrismaClient and the tx callback.
  prisma.$transaction.mockImplementation(async (callback: (tx: typeof prisma) => unknown) => callback(prisma));

  return { mockPrisma: prisma, mockGetCurrentUserOrThrow: vi.fn() };
});

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/server/auth/session", () => ({ getCurrentUserOrThrow: mockGetCurrentUserOrThrow }));

const {
  approveDocument,
  archiveDocument,
  createDocument,
  getDocument,
  listDocuments,
  publishDocument,
  rejectDocument,
  revertToDraft,
  submitDocument,
  updateDocument,
} = await import("@/server/documents/service");
const { ConflictError, ForbiddenError, InvalidTransitionError, NotFoundError } = await import(
  "@/server/shared/errors"
);

function makeUser(role: Role, id = "user-1"): SessionUser {
  return { id, email: `${role.toLowerCase()}@example.com`, name: role, role };
}

function makeDocument(overrides: Partial<Document> = {}): Document {
  return {
    id: "doc-1",
    title: "Q3 Report",
    content: "Body text",
    status: "DRAFT",
    version: 1,
    authorId: "author-1",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  mockPrisma.$transaction.mockImplementation(async (callback: (tx: typeof mockPrisma) => unknown) =>
    callback(mockPrisma),
  );
  mockPrisma.auditLog.create.mockResolvedValue({});
});

describe("createDocument", () => {
  it("denies VIEWER from creating a document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("VIEWER"));

    await expect(createDocument({ title: "New", content: "Body" })).rejects.toThrow(ForbiddenError);
    expect(mockPrisma.document.create).not.toHaveBeenCalled();
  });

  it("denies REVIEWER from creating a document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER"));

    await expect(createDocument({ title: "New", content: "Body" })).rejects.toThrow(ForbiddenError);
  });

  it("creates a DRAFT document and records a CREATE audit entry in the same transaction", async () => {
    const author = makeUser("AUTHOR", "author-1");
    mockGetCurrentUserOrThrow.mockResolvedValue(author);
    mockPrisma.document.create.mockResolvedValue(makeDocument({ authorId: author.id }));

    const result = await createDocument({ title: "New", content: "Body" });

    expect(result.status).toBe("DRAFT");
    expect(mockPrisma.document.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ authorId: author.id, status: "DRAFT" }) }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "CREATE", fromStatus: null, toStatus: "DRAFT" }),
      }),
    );
    // Both writes happened inside the same $transaction call.
    expect(mockPrisma.$transaction).toHaveBeenCalledTimes(1);
  });
});

describe("updateDocument — ownership and state", () => {
  it("denies an AUTHOR from editing a document they don't own", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "someone-else"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1" }));

    await expect(updateDocument("doc-1", { version: 1, title: "New title" })).rejects.toThrow(ForbiddenError);
    expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("rejects editing a document that is not in DRAFT status", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "SUBMITTED" }));

    await expect(updateDocument("doc-1", { version: 1, title: "New title" })).rejects.toThrow(ConflictError);
  });

  it("throws NotFoundError for an unknown document id", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(null);

    await expect(updateDocument("missing-doc", { version: 1, title: "New title" })).rejects.toThrow(NotFoundError);
  });

  it("allows the owning AUTHOR to edit their own DRAFT document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await updateDocument("doc-1", { version: 1, title: "Updated title" });

    expect(mockPrisma.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: "doc-1", version: 1 } }),
    );
    // Editing content is not a workflow transition, so no audit entry.
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("optimistic concurrency conflicts", () => {
  it("returns ConflictError when updateDocument's version is stale", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(updateDocument("doc-1", { version: 1, title: "Updated title" })).rejects.toThrow(ConflictError);
  });

  it("returns ConflictError when a transition's version is stale", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 0 });

    await expect(submitDocument("doc-1", { version: 1 })).rejects.toThrow(ConflictError);
    // The audit log must never be written for a transition that didn't happen.
    expect(mockPrisma.auditLog.create).not.toHaveBeenCalled();
  });
});

describe("submitDocument — valid and invalid transitions", () => {
  it("rejects submitting a document that is not in DRAFT status", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "SUBMITTED" }));

    await expect(submitDocument("doc-1", { version: 1 })).rejects.toThrow(InvalidTransitionError);
    expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("submits a DRAFT document owned by the actor and records the audit entry", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await submitDocument("doc-1", { version: 1 });

    expect(mockPrisma.document.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: "doc-1", version: 1, status: "DRAFT" },
        data: expect.objectContaining({ status: "SUBMITTED" }),
      }),
    );
    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "SUBMIT", fromStatus: "DRAFT", toStatus: "SUBMITTED" }),
      }),
    );
  });
});

describe("approveDocument / rejectDocument — self-review prevention", () => {
  it("denies a REVIEWER from approving their own document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(
      makeDocument({ authorId: "reviewer-1", status: "SUBMITTED" }),
    );

    await expect(approveDocument("doc-1", { version: 1 })).rejects.toThrow(ForbiddenError);
    expect(mockPrisma.document.updateMany).not.toHaveBeenCalled();
  });

  it("denies a REVIEWER from rejecting their own document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(
      makeDocument({ authorId: "reviewer-1", status: "SUBMITTED" }),
    );

    await expect(rejectDocument("doc-1", { version: 1, reason: "Needs more detail" })).rejects.toThrow(
      ForbiddenError,
    );
  });

  it("allows an ADMIN to approve a document they authored (no self-review restriction)", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("ADMIN", "admin-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "admin-1", status: "SUBMITTED" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await expect(approveDocument("doc-1", { version: 1 })).resolves.toBeDefined();
  });

  it("allows a REVIEWER to approve a document authored by someone else", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "SUBMITTED" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await approveDocument("doc-1", { version: 1 });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ action: "APPROVE", fromStatus: "SUBMITTED", toStatus: "APPROVED" }),
      }),
    );
  });

  it("records the rejection reason in the audit log metadata", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "SUBMITTED" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await rejectDocument("doc-1", { version: 1, reason: "Missing appendix" });

    expect(mockPrisma.auditLog.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          action: "REJECT",
          fromStatus: "SUBMITTED",
          toStatus: "REJECTED",
          metadata: { reason: "Missing appendix" },
        }),
      }),
    );
  });
});

describe("publishDocument — role rules", () => {
  it("denies an AUTHOR from publishing", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "APPROVED" }));

    await expect(publishDocument("doc-1", { version: 1 })).rejects.toThrow(ForbiddenError);
  });

  it("allows a REVIEWER to publish an APPROVED document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "APPROVED" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await expect(publishDocument("doc-1", { version: 1 })).resolves.toBeDefined();
  });

  it("rejects publishing a document that has not been approved", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("ADMIN", "admin-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ status: "DRAFT" }));

    await expect(publishDocument("doc-1", { version: 1 })).rejects.toThrow(InvalidTransitionError);
  });
});

describe("archiveDocument — admin-only", () => {
  it("denies a REVIEWER from archiving", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ status: "PUBLISHED" }));

    await expect(archiveDocument("doc-1", { version: 1 })).rejects.toThrow(ForbiddenError);
  });

  it("denies an AUTHOR from archiving even their own document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));

    await expect(archiveDocument("doc-1", { version: 1 })).rejects.toThrow(ForbiddenError);
  });

  it("allows an ADMIN to archive a PUBLISHED document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("ADMIN", "admin-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ status: "PUBLISHED" }));
    mockPrisma.document.updateMany.mockResolvedValue({ count: 1 });

    await expect(archiveDocument("doc-1", { version: 1 })).resolves.toBeDefined();
  });
});

describe("revertToDraft — ownership and transition", () => {
  it("rejects reverting a document that is not REJECTED", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));

    await expect(revertToDraft("doc-1", { version: 1 })).rejects.toThrow(InvalidTransitionError);
  });

  it("denies an AUTHOR from reverting someone else's rejected document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "someone-else"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "REJECTED" }));

    await expect(revertToDraft("doc-1", { version: 1 })).rejects.toThrow(ForbiddenError);
  });
});

describe("getDocument — viewer restrictions", () => {
  it("denies a VIEWER from seeing a non-published document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("VIEWER", "viewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ status: "DRAFT" }));

    await expect(getDocument("doc-1")).rejects.toThrow(ForbiddenError);
  });

  it("allows a VIEWER to see a published document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("VIEWER", "viewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ status: "PUBLISHED" }));

    const result = await getDocument("doc-1");
    expect(result.status).toBe("PUBLISHED");
  });

  it("allows the owning AUTHOR to see their own DRAFT document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findUnique.mockResolvedValue(makeDocument({ authorId: "author-1", status: "DRAFT" }));

    const result = await getDocument("doc-1");
    expect(result.status).toBe("DRAFT");
  });

  it("throws NotFoundError before any visibility check for a missing document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("VIEWER", "viewer-1"));
    mockPrisma.document.findUnique.mockResolvedValue(null);

    await expect(getDocument("missing-doc")).rejects.toThrow(NotFoundError);
  });
});

describe("listDocuments — role-scoped visibility", () => {
  const mixedDocuments = [
    makeDocument({ id: "d-draft", authorId: "author-1", status: "DRAFT" }),
    makeDocument({ id: "d-submitted", authorId: "author-2", status: "SUBMITTED" }),
    makeDocument({ id: "d-published", authorId: "author-2", status: "PUBLISHED" }),
  ];

  it("scopes an AUTHOR's list to only documents they own", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("AUTHOR", "author-1"));
    mockPrisma.document.findMany.mockResolvedValue(mixedDocuments);

    const result = await listDocuments();

    expect(result.map((document) => document.id)).toEqual(["d-draft"]);
  });

  it("scopes a VIEWER's list to only published documents", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("VIEWER", "viewer-1"));
    mockPrisma.document.findMany.mockResolvedValue(mixedDocuments);

    const result = await listDocuments();

    expect(result.map((document) => document.id)).toEqual(["d-published"]);
  });

  it("gives REVIEWER and ADMIN visibility into every document", async () => {
    mockGetCurrentUserOrThrow.mockResolvedValue(makeUser("REVIEWER", "reviewer-1"));
    mockPrisma.document.findMany.mockResolvedValue(mixedDocuments);

    const result = await listDocuments();

    expect(result).toHaveLength(3);
  });
});
