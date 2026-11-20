# SmartLMS rebuild: project status

_Last updated 2026-11-20 · branch `go-react`_

The project is being rebuilt. The original **Next.js + Drizzle/Postgres** app still sits at the repo root (`app/`, `lib/`, `db/`, `components/`, …). The new app lives in two folders:

| Part | Stack | Location | Dev port |
|---|---|---|---|
| Backend | Go 1.27, `net/http` ServeMux, SQLite (`modernc.org/sqlite`), Argon2id, `openai-go` | `backend/` | 8081 |
| Frontend | React 19, Vite 8, TanStack Router / Query / Form, Phosphor icons, Sonner, AI SDK v7 | `frontend/` | 5173 |

`./dev.sh` starts both. Current health: `go build ./...` builds, `go test ./...` passes, and `tsc --noEmit` in `frontend/` reports no errors.

---

## 1. Backend: what is done

### Infrastructure
- **Migrations** run at startup (`internal/db/migrate.go`). There are 15 up-only SQL files, `000001_init` to `000015_course_weeks`.
- **Seeding** (`seed.go`, `seed_academic.go`, `seed_people.go`, `seed_weeks.go`) loads demo users, academic structure and weekly content.
- **Config** comes from env vars: `PORT`, `DB_PATH`, and `AI_ENCRYPTION_SECRET`, which has an insecure dev default.
- **Shared helpers** cover JSON responses, pagination (`pagination.go`) and `/api/meta`.

### Feature areas (about 110 routes)
| Area | Endpoints | Notes |
|---|---|---|
| Auth | `POST /api/auth/login`, `/login/2fa` | Argon2id passwords with lockout per role. The 2FA step uses a challenge ticket. |
| Two-factor | `/api/me/two-factor/*`, admin reset | TOTP (`internal/totp`) with recovery codes. Tested. |
| Roles & permissions | `/api/roles`, `/roles/{id}/permissions`, `/users/{id}/permissions` | Named permissions per module, role grants and per-user overrides. |
| Users | `GET /api/users` (paginated) | List only. There is no create, edit or delete yet. |
| Campuses | campuses → stories → classes CRUD | |
| Academic structure | faculties → departments → programmes, programme courses, student admissions | Tested. |
| School years | CRUD + `activate` (one current year) | Tested. |
| Subjects | CRUD, weeks, lectures, quizzes, flashcards | Content belongs to the subject. The course layer was removed in `576df1e`. |
| Assignments | CRUD, submissions, grading via `PATCH /submissions/{id}` | |
| Quizzes | attempts, submit, per-student attempt history | |
| Grades | grade scales, grade components, entries, gradebook, student results/record | Calculation logic is in `internal/grades` and tested. |
| Forums | forums → threads → posts | |
| Notifications | list, mark read, read-all | |
| AI | providers (API keys encrypted with AES-GCM via `keycrypt`), model sync, settings, `POST /api/ai/chat` streaming SSE in Vercel AI UI-message format | |
| User prefs | appearance, MCP apps | |
| MCP server | `POST /api/mcp` (JSON-RPC 2.0), `GET /api/mcp/tools` | The backend's own create actions as MCP tools — subjects, weeks, lectures, assignments, quizzes, flashcards, forum threads — gated on the caller's permissions. See `docs/mcp.md`. |

## 2. Frontend: what is done

- **Shell:** `AppShell` with a sidebar grouped by module (`modules.ts`), `ModuleGate`, a user menu, a 404 page, and themes and appearance settings, including Atkinson Hyperlegible and OpenDyslexic fonts.
- **Auth:** a login page with a 2FA step. The session (user, modules, permissions) is stored in `localStorage`.
- **Design system:** `components/ui/` provides Button, TextField, Select, Dialog, Table, Pagination, Skeleton, States and more.
- **Routes:** dashboard, users, students, access (permissions), campuses, academic, school years, subjects and subject detail (weeks, gradebook, forum, staff overviews), assignments and assignment detail, grades, academic record, settings, AI assistant (General, Personalization, Providers, MCP tabs)/chat, plus a floating chat widget.
- **Forms:** create/edit dialogs for every academic and subject entity (TanStack Form).

---

## 3. What needs work

Ordered by priority. The first item is a blocker.

### 🔴 Critical
1. **The API has no real authentication or authorization.** Login returns user data but issues no session token or cookie. Later requests carry no credential, and the handlers don't check the caller's identity or permissions. Some handlers (e.g. `ai_providers.go`) take a `user_id` query parameter, which a client can set to anything. Anyone who can reach port 8081 can read and change every record. The fix:
   - issue a session (an HttpOnly cookie or a signed token) on login and after the 2FA step,
   - add middleware that resolves the current user and enforces the permissions already modelled in the database,
   - remove every `user_id` that comes from the client.
2. **`AI_ENCRYPTION_SECRET` falls back to a hardcoded dev value.** Production startup should refuse to run without a real secret.
3. **Login lockout and 2FA codes have no rate limit by IP**, only lockout by account.

### 🟠 Important
4. **The two codebases are mixed together.** `README.md`, `docs/seed-data.md` and the other docs still describe the Next.js app (`npm run db:seed`, Postgres, pgvector, clubs, the scheduling engine). Pick one:
   - remove the legacy root app or move it to `legacy/`,
   - rewrite the README for Go + Vite.
5. **The branch is mostly uncommitted.** Dozens of modified and untracked files (migrations 7–15, most handlers, the whole frontend rewrite). Commit them in logical slices before anything is lost.
6. **Features from the old app are missing:** clubs and club chat, announcements, timetable/scheduling (CSP solver), professor availability, RAG / semantic cache for the AI tutor, and AI-generated quizzes and flashcards. Decide which ones to port.
7. **Users are incomplete:** there is no create, edit, deactivate or password-reset endpoint, and no bulk import of students.
8. **Testing is thin.** Only auth, totp, grades and four handler areas have tests. Assignments, quizzes, forums, AI and permissions have none. The frontend has no tests at all (no Vitest, no Playwright).
9. **Migrations are up-only**, with no down files. That's fine for SQLite in dev but should be a conscious decision.
10. **File uploads:** assignment submissions and lecture materials need storage (local disk or S3/R2) and size and type limits.

### 🟡 Nice to have
11. **Deployment:** a Dockerfile and a production build where Go serves `frontend/dist`, plus CI (go test, tsc, lint), structured logging and request IDs.
12. **API contract:** an OpenAPI spec or generated TS types, so `frontend/src/api.ts` (about 750 lines of hand-written types) can't drift from the backend.
13. **Real-time:** notifications and forums poll today. SSE/WebSocket push would be better.
14. **Frontend quality:** add ESLint/Prettier to `frontend/`, run an accessibility pass, check mobile layouts, and add error boundaries for each route.
15. **Search and pagination** should be consistent across every list endpoint, not only users.

---

## 4. Suggested next steps
1. Implement sessions and permission middleware (item 1), with tests.
2. Commit the current work in slices, then archive the legacy Next.js app and rewrite the README.
3. Finish user management and file uploads.
4. Choose which legacy features to port, starting with announcements and the AI tutor's RAG.
5. Add CI and a Docker build.
