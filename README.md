# OptimoLMS

A Next.js learning management system with week-based courses, assignments, quizzes, AI tutoring, clubs, and academic scheduling.

## Requirements

- Node.js 20+
- PostgreSQL with pgvector extension (Supabase compatible)

## Setup

1. Install dependencies:

```bash
npm install
```

2. Copy environment variables (see `lib/env.ts` for required keys):

```bash
cp .env.example .env.local
```

3. Apply database schema:

```bash
npm run db:push
```

4. Seed demo data (optional):

```bash
npm run db:seed
```

5. Start development server:

```bash
npm run dev
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start Next.js dev server |
| `npm run build` | Production build |
| `npm run typecheck` | TypeScript check |
| `npm run lint` | ESLint |
| `npm run test` | Run Vitest unit tests |
| `npm run db:push` | Push Drizzle schema to database |
| `npm run db:seed` | Seed demo users and courses |

## User roles

See [docs/seed-data.md](docs/seed-data.md) for demo account credentials after seeding.

- **ADMIN** — academic structure, schedules, users, settings
- **PROFESSOR** — courses, grading, availability, content
- **STUDENT** — enrollments, submissions, quizzes, grades

## Architecture

- **App routes:** `app/(dashboard)/{admin,professor,student}/`
- **Server actions:** `lib/actions/`
- **Scheduling engine:** `lib/scheduling/` (equilibrium CSP solver)
- **Permissions:** `lib/permissions/` — see [docs/permission-system.md](docs/permission-system.md)
- **AI:** RAG chat (`app/api/ai/chat`), semantic cache (`lib/ai/semantic-cache.ts`)

Full layout: [project-structure.md](project-structure.md)

## Key features

- Assignment submission and professor grading with feedback
- Quiz attempts with personalized lecture review suggestions
- Balanced timetable generation (2h blocks, professor availability, group equilibrium)
- Two-factor authentication (TOTP) for every account — see [docs/two-factor.md](docs/two-factor.md)
- School years as a first-class academic calendar, one current at a time, with
  subjects filed by year — see [docs/school-years.md](docs/school-years.md)
- Faculties → departments → programmes, each programme with its own curriculum
  and its admitted students — see [docs/academic-structure.md](docs/academic-structure.md)
- Fall and summer seasons, and a subject read week by week with the content
  taught in each week — see [docs/course-weeks.md](docs/course-weeks.md)
- In-app notifications for grades and announcements
- Student groups and subject assignments for institutional scheduling

## Testing

```bash
npm run test
```

Tests cover scheduling equilibrium heuristics and quiz review ranking helpers.
