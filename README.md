# ElevateBox Document Approval

A production-quality Document Approval Workflow system built to demonstrate clean architecture, server-side authorization (RBAC), a state-machine-driven workflow, database integrity, transactional audit logging, and optimistic concurrency control — deliberately with a minimal, unstyled-by-design UI, since the point of this project is the engineering underneath it, not the visual polish.

## Project Overview

Four seeded users — an Author, a Reviewer, an Admin, and a Viewer — collaborate on documents that move through a fixed six-state workflow:

```
Draft → Submitted → Approved → Published
          ↓  ↑
       Rejected → Draft

Draft, Submitted, Approved, Published → Archived (from any of the four)
```

Every transition is validated server-side against a single source of truth (a transition table), gated by role- and ownership-aware authorization, protected against lost updates with optimistic concurrency (a `version` column), and recorded in an immutable audit trail — all inside the same database transaction as the state change itself.

## Features

- **Seeded session authentication** — no passwords; sign in as one of four fixed users.
- **Role-based access control** — Author, Reviewer, Admin, Viewer, each with a distinct permission surface, enforced server-side on every request.
- **State-machine-driven workflow** — Draft → Submitted → Approved/Rejected → Published/Draft, plus Archive from any non-terminal state. Invalid transitions are rejected with `409 Conflict`.
- **Optimistic concurrency control** — every mutation carries the `version` it last read; a stale write is rejected atomically, never silently overwritten.
- **Transactional audit logging** — every state change and its audit entry commit or roll back together, in the same `prisma.$transaction`.
- **Self-review prevention** — a Reviewer can never approve or reject a document they authored.
- **Viewer visibility restriction** — Viewers can only see Published documents.
- **Full frontend** — login, dashboard with live statistics, a filterable/searchable documents table, a document detail page with role- and status-aware action buttons, a chronological audit timeline, optimistic document creation, and conflict/validation/error toasts.

## Architecture

Layered, one-directional dependency flow:

```
Route Handler  →  Service  →  Domain (workflow + rbac)  →  Repository  →  Prisma
   (HTTP)          (use case)      (pure logic)             (data access)
```

- **Route handlers** (`src/app/api/**/route.ts`) are intentionally thin: parse the request, validate the body with Zod, call one service function, map the result to an HTTP response via a single error-to-response translator.
- **Service layer** (`src/server/documents/service.ts`) is the only orchestration point for every use case: authenticate → load → authorize (role + ownership) → validate the workflow transition → run a `$transaction` that performs the atomic compare-and-swap write and writes the paired audit log entry → return a DTO.
- **Domain layer** (`workflow.ts`, `rbac.ts`) is pure, I/O-free TypeScript — a transition table and a permission matrix — so it is exhaustively unit-testable without a database.
- **Repository layer** (`repository.ts`) is the only place that talks to Prisma for documents/audit logs, using `updateMany` with a compound `WHERE (id, version[, status])` clause as the atomic concurrency guard.
- **Frontend** talks to the API exclusively through TanStack Query hooks (`src/hooks/*`) and a typed `fetch` wrapper (`src/lib/api-client.ts`) — never directly to Prisma or the service layer, even though it runs in the same codebase.

See [DESIGN.md](DESIGN.md) for the full reasoning behind every one of these decisions.

## Folder Structure

```
prisma/
  schema.prisma            # User, Session, Document, AuditLog + enums
  seed.ts                  # seeds the four fixed users

src/
  app/
    (auth)/login/          # seeded-session login (server guard + client form)
    (dashboard)/            # authenticated shell
      layout.tsx            # header: user name, role badge, logout, nav
      dashboard/            # status statistics
      documents/            # table, search, status filter, create dialog
        [id]/               # detail page: content, actions, audit timeline
    api/
      auth/login|logout/    # session endpoints
      documents/            # collection + item + one route per transition
      users/                # read-only user directory (for display names)
    layout.tsx, page.tsx, globals.css

  components/
    ui/                     # shadcn/ui primitives (button, dialog, table, form, ...)
    documents/              # status/role badges, dialogs, action buttons, timeline
    layout/                 # dashboard header
    providers.tsx           # QueryClientProvider + Toaster
    conflict-dialog.tsx     # app-wide 409 "this document has changed" dialog

  hooks/                    # TanStack Query hooks (documents, users, auth, errors)
  lib/                      # prisma client, env validation, api client, cn()

  server/
    auth/                   # session (login/logout/getCurrentUser), rbac
    documents/              # workflow state machine, zod schemas, repository, service
    audit/                  # audit log writer
    shared/                 # error classes, HTTP error mapper, small utils

  types/                    # shared SessionUser type + re-exported Prisma types
```

## Tech Stack

**Frontend** — Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS, shadcn/ui, TanStack Query, React Hook Form
**Backend** — Next.js Route Handlers, Prisma ORM, PostgreSQL, Zod
**Auth** — seeded session cookies (no OAuth, no passwords)
**Testing** — Vitest

## Setup Instructions

### Prerequisites

- Node.js 20+
- A running PostgreSQL instance (local or hosted)

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment variables, set up the database, and seed users

The three sections below cover this. Then skip to [Running Locally](#running-locally).

## Environment Variables

Copy `.env.example` to `.env` and adjust as needed:

```bash
cp .env.example .env
```

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://postgres:postgres@localhost:5432/elevatebox_document_approval?schema=public` |
| `SESSION_COOKIE_NAME` | Name of the session cookie | `eb_session` |
| `SESSION_DURATION_DAYS` | Session lifetime in days | `7` |

## Database Setup

Create the schema (applies all migrations, creating the database if it doesn't already exist):

```bash
npm run prisma:migrate
```

Generate the Prisma client (also runs automatically after `npm install`/`prisma migrate`):

```bash
npm run prisma:generate
```

## Seed Users

```bash
npm run prisma:seed
```

This upserts four fixed accounts:

| Email | Role |
|---|---|
| `alice@example.com` | Author |
| `bob@example.com` | Reviewer |
| `admin@example.com` | Admin |
| `viewer@example.com` | Viewer |

## Running Locally

```bash
npm run dev
```

Open `http://localhost:3000` — you'll be redirected to `/login`, where each of the four accounts is a single-click card (no password).

### Other scripts

```bash
npm run build          # production build
npm run start          # run the production build
npm run typecheck      # tsc --noEmit
npm run test           # run the Vitest suite once
npm run test:watch     # Vitest in watch mode
npm run prisma:studio  # Prisma Studio GUI
```

## API Endpoints

All endpoints require a valid session cookie except `/api/auth/login`. Every response follows `{ ...data }` on success or `{ error: { code, message, issues? } }` on failure.

| Method | Path | Description | Success | Notable failures |
|---|---|---|---|---|
| `POST` | `/api/auth/login` | Sign in as a seeded user by email | `200` | `401` unknown email |
| `POST` | `/api/auth/logout` | End the current session | `204` | — |
| `GET` | `/api/documents` | List documents, scoped by role | `200` | `401` |
| `POST` | `/api/documents` | Create a Draft document | `201` | `401` `403` `422` |
| `GET` | `/api/documents/:id` | Get one document | `200` | `401` `403` `404` |
| `PATCH` | `/api/documents/:id` | Edit title/content (Draft only) | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/submit` | Draft → Submitted | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/approve` | Submitted → Approved | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/reject` | Submitted → Rejected (requires `reason`) | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/publish` | Approved → Published | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/archive` | Draft/Submitted/Approved/Published → Archived | `200` | `401` `403` `404` `409` `422` |
| `POST` | `/api/documents/:id/revert-to-draft` | Rejected → Draft | `200` | `401` `403` `404` `409` `422` |
| `GET` | `/api/documents/:id/audit` | Chronological audit trail for a document | `200` | `401` `403` `404` |
| `GET` | `/api/users` | Read-only user directory (id/name/email/role) | `200` | `401` |

Every mutating endpoint's request body includes a `version` field (the optimistic-concurrency token read from the last `GET`); a mismatch returns `409 Conflict`.
