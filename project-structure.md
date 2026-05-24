# Project Structure (SmartLMS)

This document describes the codebase layout and how to access key areas. The project uses **Next.js App Router** with **shadcn/ui** components.

## Overview

- **Framework**: Next.js (App Router)
- **UI**: shadcn/ui components under `components/ui`
- **Database**: Drizzle (`drizzle.config.ts`, `db/`)
- **Auth**: NextAuth (`app/api/auth/[...nextauth]`)
- **AI/RAG**: `lib/ai`, `lib/rag`, `app/api/ai`

## Root files

- `package.json` / `package-lock.json`: dependencies and scripts.
- `next.config.mjs`: Next.js config.
- `tsconfig.json`: TypeScript config.
- `drizzle.config.ts`: Drizzle ORM configuration.
- `check.ts`, `proxy.ts`: project utilities.
- `.prettierrc`, `.prettierignore`, `eslint.config.mjs`: lint/format configs.

## Application routes (`app/`)

> **Access rule:** In App Router, each folder with a `page.tsx` maps to a route. Route groups like `(dashboard)` do **not** affect the URL path.

### Top-level pages

- `/` → `app/page.tsx`
- `/dashboard` → `app/dashboard/page.tsx`
- `/example` → `app/example/page.tsx`
- `/sign-in` → `app/sign-in/page.tsx`

### Dashboard route group (`app/(dashboard)`)

- Shared layout: `app/(dashboard)/layout.tsx`

#### Admin routes

- `/admin` → `app/(dashboard)/admin/page.tsx`
- `/admin/academic` → `app/(dashboard)/admin/academic/page.tsx`
- `/admin/academic/enrollments` → `app/(dashboard)/admin/academic/enrollments/page.tsx`
- `/admin/academic/school-years` → `app/(dashboard)/admin/academic/school-years/page.tsx`
- `/admin/academic/school-years/new` → `app/(dashboard)/admin/academic/school-years/new/page.tsx`
- `/admin/academic/study-programs` → `app/(dashboard)/admin/academic/study-programs/page.tsx`

#### Professor routes

- `/professor` → `app/(dashboard)/professor/page.tsx`
- `/professor/clubs` → `app/(dashboard)/professor/clubs/page.tsx`
- `/professor/clubs/[id]` → `app/(dashboard)/professor/clubs/[id]/page.tsx`
- `/professor/courses` → `app/(dashboard)/professor/courses/page.tsx`
- `/professor/courses/[id]` → `app/(dashboard)/professor/courses/[id]/page.tsx`
- `/professor/courses/[id]/files/new` → `app/(dashboard)/professor/courses/[id]/files/new/page.tsx`
- `/professor/courses/[id]/flashcards/new` → `app/(dashboard)/professor/courses/[id]/flashcards/new/page.tsx`
- `/professor/courses/[id]/folders/new` → `app/(dashboard)/professor/courses/[id]/folders/new/page.tsx`
- `/professor/courses/[id]/folders/[folderId]` → `app/(dashboard)/professor/courses/[id]/folders/[folderId]/page.tsx`
- `/professor/courses/[id]/quizzes/new` → `app/(dashboard)/professor/courses/[id]/quizzes/new/page.tsx`
- `/professor/settings` → `app/(dashboard)/professor/settings/page.tsx`

#### Student routes

- `/student` → `app/(dashboard)/student/page.tsx`
- `/student/clubs` → `app/(dashboard)/student/clubs/page.tsx`
- `/student/clubs/[id]` → `app/(dashboard)/student/clubs/[id]/page.tsx`
- `/student/courses` → `app/(dashboard)/student/courses/page.tsx`
- `/student/courses/[id]` → `app/(dashboard)/student/courses/[id]/page.tsx`
- `/student/settings` → `app/(dashboard)/student/settings/page.tsx`

### API routes (`app/api`)

> **Access rule:** Files named `route.ts` map to API endpoints.

- `POST/GET /api/auth/*` → `app/api/auth/[...nextauth]/route.ts` (NextAuth)
- `POST /api/ai/chat` → `app/api/ai/chat/route.ts`
- `POST /api/uploads/signed-url` → `app/api/uploads/signed-url/route.ts`
- `POST /api/uploads/finalize` → `app/api/uploads/finalize/route.ts`
- `GET /api/uploads/download` → `app/api/uploads/download/route.ts`

## Components (`components/`)

- Shared UI and feature components.
- `components/ui`: shadcn/ui primitives.
- Examples: `app-sidebar.tsx`, `auth-provider.tsx`, `course-ai-overlay.tsx`, forms and modals.

## Hooks (`hooks/`)

- Custom React hooks:
  - `use-chat-typing.ts`
  - `use-club-chat-realtime.ts`
  - `use-mobile.ts`

## Libraries (`lib/`)

- **Auth**: `lib/auth.ts`, `lib/auth-guard.ts`
- **Env**: `lib/env.ts`
- **Utilities**: `lib/utils.ts`
- **Actions** (server actions): `lib/actions/*` (academic, courses, files, quizzes, etc.)
- **AI**: `lib/ai/*`
- **RAG**: `lib/rag/*`
- **Queues**: `lib/queues/*`
- **Chat**: `lib/chat/*`
- **Supabase**: `lib/supabase/*`
- **Validation**: `lib/validation/*`

## Database (`db/`)

- Schema and migration helpers:
  - `db/schema.ts`
  - `db/index.ts`
  - `db/seed.ts`
  - `db/run-migration.ts`
  - `db/reset-db.ts`
- Migration files: `db/migrations/`
- SQL snapshots: `db/sql/`

## Scripts (`scripts/`)

- Database checks and migration helpers in `.cjs` and `.js`.
- Worker-related code in `scripts/workers/`.

## Types (`types/`)

- `types/next-auth.d.ts`: NextAuth type augmentation.

## Public assets (`public/`)

- Static assets served at the root (e.g., `/some-asset.png`).

## Generated and vendor directories

- `.next/`: Next.js build output (generated).
- `node_modules/`: dependencies (generated).

## Naming and access conventions

- **Pages**: `page.tsx` files define routes.
- **Layouts**: `layout.tsx` files wrap route segments.
- **Dynamic routes**: `[id]`, `[folderId]` map to URL params.
- **Route groups**: `(dashboard)` organize code without changing the URL.
- **API routes**: `route.ts` under `app/api/**`.

If you want a more detailed mapping (e.g., file-level responsibilities), tell me which area to expand.