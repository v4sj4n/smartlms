# OptimoLMS rebuild: project status

_Last updated 2026-11-21 · branch `go-react`_

The project is being rebuilt. The original **Next.js + Drizzle/Postgres** app has been removed (it stays in the history of `main`); only the new app is left, in two folders:

| Part | Stack | Location | Dev port |
|---|---|---|---|
| Backend | Go 1.27, `net/http` ServeMux, SQLite (`modernc.org/sqlite`), Argon2id, `openai-go` | `backend/` | 8081 |
| Frontend | React 19, Vite 8, TanStack Router / Query / Form, Phosphor icons, Sonner, AI SDK v7 | `frontend/` | 5173 |

`./dev.sh` starts both. Current health: `go build ./...` builds, `go test ./...` passes, and `tsc --noEmit` in `frontend/` reports no errors.

**The API is authenticated.** Every request except `/api/auth/*`, `/api/meta` and `/api/health` needs a session, and the route policy in `backend/internal/handler/session.go` decides who may call what. See §1.1.

---

## 1. Backend: what is done

### Infrastructure
- **Migrations** run at startup (`internal/db/migrate.go`). There are 20 up-only SQL files, `000001_init` to `000020_ai_provider_health`.
- **Seeding** (`seed.go`, `seed_academic.go`, `seed_people.go`, `seed_weeks.go`) loads demo users, academic structure and weekly content.
- **Config** comes from env vars: `PORT`, `DB_PATH`, and `AI_ENCRYPTION_SECRET`, which has an insecure dev default.
- **Shared helpers** cover JSON responses, pagination (`pagination.go`) and `/api/meta`.

### Feature areas (about 110 routes)
| Area | Endpoints | Notes |
|---|---|---|
| Auth | `POST /api/auth/login`, `/login/2fa`, `/logout`, `GET /api/me` | Argon2id passwords with lockout per role. The 2FA step uses a challenge ticket. Signing in mints a session (see §1.1). |
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
| AI | `POST /api/ai/providers/connect` (verify + discover + starter models in one call), keys encrypted with AES-GCM via `keycrypt` and only replaced after verification, `POST /providers/{id}/test` health checks, `POST /providers/{id}/models/bulk`, settings, `POST /api/ai/chat` streaming SSE in Vercel AI UI-message format. See `docs/ai-providers.md`. |
| User prefs | appearance, MCP apps | |
| MCP server | `POST /api/mcp` (JSON-RPC 2.0), `GET /api/mcp/tools` | The backend's own create actions as MCP tools — subjects, weeks, lectures, assignments, quizzes, flashcards, forum threads — gated on the caller's permissions. See `docs/mcp.md`. |

### 1.1 Sessions and authorization (was item 1, done)

- **Mechanism: an HttpOnly cookie holding an opaque token.** `POST /api/auth/login` — and `POST /api/auth/login/2fa` for a 2FA account — mints 32 random bytes, stores only their SHA-256 hash in `sessions` (migration `000019`), and sets `optimolms_session` (`HttpOnly`, `Path=/`, `SameSite=Lax`, 12-hour absolute expiry). The cookie works in dev because the Vite server proxies `/api` to `:8081`, so the browser sees one origin; a token in an `Authorization` header would have bought nothing there and would have cost us the XSS protection. The same token is also returned in the login body as `token`, so a non-browser client (an MCP client, `curl`) can send `Authorization: Bearer <token>` instead of a cookie.
- **One entry point for identity.** `withSessions` (`internal/handler/session.go`) runs in front of the mux: it resolves the token, loads the caller from the database (role, modules, effective permissions — so a permission change applies on the next request), enforces the route policy, and puts the caller in the request context. `Register` returns that chain, so no route can bypass it.
- **The policy** is derived from the registered ServeMux pattern: public (`/api/auth/*`, `/api/meta`, `/api/health`), administrator-only (`/api/roles*`, `/api/users/{id}/permissions`, `POST /api/users/{id}/two-factor/reset`), permission-gated per module and method (`subjects.manage` for a write under `/api/subjects`, `academic.view` for a read under `/api/academic`, …), and signed-in only for a person's own corner (`/api/me/*`, `/api/notifications`, `/api/ai/*`, `/api/mcp`). Missing session → 401, missing permission → 403.
- **No client-supplied identity anywhere.** Handlers read `callerFrom(r)`; no `user_id` query parameter or identity header decides who is calling. A path id may still name another user, but only as the *target* of an administrator's action (`/api/users/{id}/…`).
- **Sign-out:** `POST /api/auth/logout` deletes that one session row and clears the cookie. `GET /api/me` returns the caller as the database sees them (`user`, `role`, `modules`, `permissions`, `expires_at`), and the frontend hydrates from it on every boot instead of trusting its cached copy.
- **Frontend:** `src/api.ts` sends `credentials: "include"` on every call, exposes `api.me()` / `api.logout()`, and reports a 401 through `onUnauthorized`; `AuthProvider` turns that into a return to `/login`.
- **Tests:** `backend/internal/handler/session_test.go` covers issuance, cookie flags, `/api/me`, bearer tokens, expiry (with the row swept), logout (only that device), the public allow-list, the 401/403 matrix for admin vs lecturer vs student, that identity comes from the session even when the request names somebody else, and the 2FA handshake issuing a real session.

**Leftovers in this area:** rate limiting per IP on login and 2FA codes (item 3) is still open; the session is absolute (no sliding refresh) and there is no "sign out everywhere"; CSRF rests on `SameSite=Lax` plus a JSON-only API (every write is `application/json`, which a cross-site form cannot send), so no CSRF token is issued — a `SameSite=None` cookie over a cross-origin frontend would need one; `Secure` is off because dev is plain http on localhost and must be flipped behind TLS.

## 2. Frontend: what is done

- **Shell:** `AppShell` with a sidebar grouped by module (`modules.ts`), `ModuleGate`, a user menu, a 404 page, and themes and appearance settings, including Atkinson Hyperlegible and OpenDyslexic fonts.
- **Auth:** a login page with a 2FA step. The session (user, modules, permissions) is stored in `localStorage`.
- **Design system:** `components/ui/` provides Button, TextField, Select, Dialog, Table, Pagination, Skeleton, States and more.
- **Routes:** dashboard, users, students, access (permissions), campuses, academic, school years, subjects and subject detail (weeks, gradebook, forum, staff overviews), assignments and assignment detail, grades, academic record, settings, AI assistant (General, Personalization, Providers, MCP tabs)/chat, plus a floating chat widget.
- **Forms:** create/edit dialogs for every academic and subject entity (TanStack Form).
- **AI providers:** one-screen connect (preset or custom endpoint + key → Connect & discover), a status pill per provider (`Ready · 3 models`, `Invalid key`, `Unreachable`), `Test connection`, non-destructive `Rotate key`, and a model catalogue with search, `Enable recommended`, `Enable all`, `Disable all` and one default. Chat surfaces (sidebar entry, floating launcher, `/chat`) appear only when `GET /api/ai/chat-models` reports `ready`, so an unconfigured assistant is not offered at all; admins still reach setup via Settings › AI — see `docs/ai-providers.md`.

---

## 3. What needs work

Ordered by priority. The first item is a blocker.

### 🔴 Critical
1. ~~**The API has no real authentication or authorization.**~~ **Done** — see §1.1: sessions (`000019_sessions`), `withSessions`, a route policy over the permissions already in the database, and no client-supplied identity left.
2. **`AI_ENCRYPTION_SECRET` falls back to a hardcoded dev value.** Production startup should refuse to run without a real secret.
3. **Login lockout and 2FA codes have no rate limit by IP**, only lockout by account.

### 🟠 Important
4. **`README.md` still describes the removed Next.js app** (`npm run db:seed`, Postgres, pgvector, clubs, the scheduling engine) and links to `docs/seed-data.md`, which is gone. The legacy root app, its Next/Drizzle/Postgres config and its migration scripts have been deleted (still in `main`'s history), so the README is now the only stale artefact — rewrite it for Go + Vite (`./dev.sh`, `:8081` / `:5173`, `docs/STATUS.md`).
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
1. Rate limiting by IP on sign-in and 2FA (item 3) — the last 🔴.
2. Commit the current work in slices, then archive the legacy Next.js app and rewrite the README.
3. Finish user management and file uploads.
4. Choose which legacy features to port, starting with announcements and the AI tutor's RAG.
5. Add CI and a Docker build.
