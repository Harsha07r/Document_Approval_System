# Design Notes

This document explains the reasoning behind the system's core engineering decisions, not what the code does line-by-line — that's what the code itself is for.

## Most Important Invariants

1. **A document's `status` never changes without a corresponding `AuditLog` row, and vice versa.** Enforced structurally: `repository.transition()` and `auditLogger.recordAuditLog()` are only ever called together, inside the same `prisma.$transaction` (`service.ts`'s `performTransition`). There is no code path that writes one without the other.
2. **A write against a stale `version` never succeeds.** Every mutating repository call (`update`, `transition`) is a single atomic `updateMany` whose `WHERE` clause includes the caller's `expectedVersion`. A `count === 0` always throws `ConflictError` — there is no "read, check in application code, then write" gap for a race to exploit.
3. **Only the transitions in the approved table are ever reachable**, regardless of role. `workflow.assertTransition` is called on every state-changing use case before the write; an Admin gets the exact same rejection as anyone else for an illegal transition (e.g., Draft → Published directly).
4. **Nothing is ever hard-deleted.** `Document.author` and both `AuditLog` relations use `onDelete: Restrict`. Archive is the only "removal" a document can undergo — the audit trail can never be silently orphaned by a cascading delete.
5. **A Reviewer can never approve or reject a document they authored.** Enforced independently of the RBAC role matrix (`assertNotSelfReview` in `service.ts`), because it's a resource-relationship rule, not a role rule.

## Database Constraints

- `User.email` — `@unique`. Login resolves a session purely by email; a duplicate would make login ambiguous.
- `Session.token` — `@unique`, a 32-byte random hex string distinct from the row's `id`, so the session cookie doesn't double as an enumerable primary key.
- `Document.version` — `Int @default(1)`, incremented by exactly `1` on every successful write (`{ increment: 1 }`, computed server-side by Postgres, never a client-supplied value). This is the optimistic-concurrency token.
- `Document.status` — a Postgres enum (`DocumentStatus`), not a free-text column, so an invalid status string is a schema-level impossibility, not just an application-level one.
- `AuditLog.fromStatus` is nullable; `AuditLog.toStatus` is not — a `CREATE` entry legitimately has no prior state, but every entry must record what state it produced.
- `onDelete: Restrict` on `Document.author`, `AuditLog.document`, and `AuditLog.actor` — the database itself refuses a delete that would orphan a document or an audit entry, independent of whether the application code remembers to check.
- Indexes on `Document.status`, `Document.authorId`, `AuditLog.documentId`, `AuditLog.actorId`, `Session.userId` — the four access patterns the app actually performs (status-filtered lists, "my documents", a document's history, a session's owner).

## RBAC Strategy

Two layers, deliberately kept separate:

1. **A static role → allowed-actions matrix** (`rbac.ts`'s `PERMISSIONS`), checked first. It answers "can this role ever perform this action" — a pure lookup, independent of any specific document.
2. **An ownership check**, layered on top only for the three actions where it applies (`UPDATE`, `SUBMIT`, `REVERT_TO_DRAFT`) and only for the `AUTHOR` role — Admin bypasses it entirely. This is inside the same `assertPermission` call, not a second pass, so there's exactly one function that decides "is this allowed," not two that have to agree.

Two more rules exist **outside** that matrix, in the service layer, because they aren't role rules — they're rules about the *relationship* between an actor and a specific resource:

- **Self-review prevention** (a Reviewer can't approve/reject their own document) — depends on comparing `actor.id` to `document.authorId`, which the static matrix has no concept of.
- **Viewer visibility** (a Viewer only sees `PUBLISHED` documents) — depends on the document's *current status*, not the actor's relationship to it.

Authorization is enforced exactly once per request, in the service layer, immediately after the document is loaded and before any write. Route handlers never make an authorization decision themselves — they don't even know the permission matrix exists. There's a lightweight, matching check on the frontend (`get-available-actions.ts`) purely so the right buttons render, but it is explicitly documented as non-authoritative: every one of its conditions is re-checked, independently, by the API on every request. A user editing `fetch` calls in devtools gains nothing.

## Workflow Implementation

A single adjacency table (`workflow.ts`'s `TRANSITIONS: Record<DocumentStatus, DocumentStatus[]>`) is the only place the six-state machine is defined. `assertTransition(from, to)` is a pure, synchronous, side-effect-free function — no database, no request context — which makes it exhaustively unit-testable: the test suite checks all 36 `from × to` combinations against an independently-declared expected table, not by importing and trivially re-asserting `workflow.ts`'s own data.

The table is consulted twice per transition, for two different purposes:

- **Before the write**, in `service.ts`, so an invalid attempt fails fast with a clear `InvalidTransitionError` before touching a transaction.
- **During the write**, implicitly, because `repository.transition`'s `WHERE` clause includes `status: fromStatus` — so even if two requests raced past the first check with the same starting status, only one can win the atomic compare-and-swap.

## Optimistic Concurrency

The client echoes back the `version` it last read; every mutation schema (`SubmitSchema`, `ApproveSchema`, etc.) requires it. The repository performs the check and the write as a single SQL statement:

```ts
db.document.updateMany({
  where: { id, version: expectedVersion, status: fromStatus },
  data: { status: toStatus, version: { increment: 1 } },
});
```

If `result.count === 0`, someone else's write already landed — the caller gets `ConflictError` → HTTP `409`. There is no separate `SELECT ... FOR UPDATE`, no application-level "check then write" gap, and no reliance on the transaction's isolation level to save an interleaving — the `WHERE` clause *is* the concurrency control, atomic by construction under Postgres's default `READ COMMITTED`.

## Transaction Boundaries

Each mutating use case wraps **only** the write and its paired audit entry in `prisma.$transaction` — not the earlier authentication, authorization, or transition-validity checks, which are read-only and re-validated atomically by the `WHERE` clause anyway. Widening the transaction to cover those checks would hold a database transaction open across work that doesn't need one, for no correctness benefit.

`updateDocument` (editing Draft content) is the one mutation *not* wrapped in an explicit `$transaction`: it has no paired audit write (content edits aren't a status change, so they're outside the `AuditAction` enum), and `repository.update` is already a single atomic statement — a transaction around one statement is a no-op.

## Audit Consistency

Every `AuditLog` row is written by exactly one function, `auditLogger.recordAuditLog`, called from exactly one place per use case — always with the same transaction client (`tx`) used for the paired state write. If the write fails (RBAC, invalid transition, or a lost `version` race), the function throws *before* the transaction ever opens, so no audit entry is created for a change that didn't happen. If the audit insert itself somehow failed, the whole `$transaction` rolls back, so the state write is undone too — there is no code path that produces a status change with no corresponding history, or a history entry for a status change that didn't commit.

## Failure Cases Considered

- **Stale write** — two users editing/transitioning the same document concurrently → the second `updateMany` matches zero rows → `409`.
- **Invalid transition** — any attempt outside the adjacency table, from any role including Admin → `409` (`InvalidTransitionError`).
- **Unauthorized role** — e.g., a Viewer calling `/submit` → `403`, before the document is even loaded for anything but the ownership check that action would otherwise need.
- **Self-review** — a Reviewer approving/rejecting their own document → `403`, independent of the role check.
- **Unknown resource** — a missing or already-deleted (in practice: archived, never deleted) document id → `404`, before any authorization is attempted against nonexistent data.
- **Unauthenticated request** — no/expired session cookie → `401`; an expired `Session` row is deleted lazily on next lookup rather than left to accumulate.
- **Malformed request body** — invalid JSON → `400`; a syntactically valid body that fails Zod validation → `422`. These are deliberately different status codes because they're different classes of client error.
- **Viewer requesting a non-public document** — `403`, so a Viewer can enumerate document ids but never their content or status before publication.

## Tradeoffs

- **Reviewer is a global role, not a per-document assignment.** Any Reviewer can act on any Submitted document. This keeps the RBAC demonstration to one dimension (role) instead of mixing in an assignment/ownership concern that the assignment didn't ask for. A per-document reviewer assignment is a natural, additive extension (`assignedReviewerId` on `Document` + one more check in `rbac.ts`) if ever needed.
- **List-view scoping for Authors ("their own documents only") was an inferred default**, not an explicit requirement — the spec only stated Viewer's single-document restriction explicitly. Reviewer/Admin see every document, since reviewing requires that visibility.
- **The frontend duplicates a narrow slice of server logic on purpose, twice:** the optimistic-create placeholder hardcodes the Draft row of the transition table (a few array literals, replaced the instant the real response arrives), and `get-available-actions.ts` mirrors the permission matrix for button visibility. Both are explicitly non-authoritative UX conveniences; the server re-derives the truth on every request regardless. The alternative — importing server-only workflow/rbac modules into client bundles — was rejected as a worse coupling than a few lines of intentional, commented duplication.
- **Two small read-only endpoints (`/api/users`, `/api/documents/:id/audit`) were added during the frontend phase** that weren't part of the original service/repository surface, because the UI cannot render an author's name or a chronological history from an `authorId`/`AuditLog` row alone. Both are additive-only: neither touches the Prisma schema, `service.ts`, nor `repository.ts`, and the audit route reuses `getDocument()`'s existing authorization (including the Viewer-published-only rule) rather than re-deriving it.
- **Sessions are a database table, not a JWT.** Slightly more I/O per request (one indexed lookup), in exchange for instant, real revocation on logout and no secret-management surface — a better fit for a system whose whole premise is auditable, inspectable state.

## Production Improvements

If this were going further than an assignment:

- **Real password/OAuth authentication**, replacing "seeded session" login, with rate limiting on the login endpoint.
- **Per-document Reviewer assignment** (and possibly multi-reviewer approval), if the business actually needs it, as described above.
- **Structured application logging and request tracing** (e.g., a request id threaded through `toHttpResponse`'s 500 branch) instead of a bare `console.error`.
- **Pagination and server-side filtering** for `/api/documents` once document counts stop being small enough for "fetch everything, filter client-side" to be reasonable — the assignment explicitly waived pagination, but that assumption doesn't scale.
- **Soft-delete/legal-hold policy** for `User` rows, since `onDelete: Restrict` currently means a user with any document or audit history can never be deleted at all — fine for four seeded users, not fine in general.
- **Rate limiting and idempotency keys** on the mutating endpoints, so a retried request after a network blip can't double-submit a transition.
- **Optimistic UI for the workflow-transition buttons**, not just document creation, once there's a clear UX answer for what to show mid-flight for a self-review rejection or a permission denial that only the server can know about.
