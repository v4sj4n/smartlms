# OptimoLMS: detailed sprint plan to reach UET LMS student parity

> Audit date 2026-11-20 · branch `go-react` · reference: read-only crawl of `lms.uet.edu.al` (Moodle 4.x + UET `local/*` plugins).

---

## 0. Ground rules for every sprint

### 0.1 Stack facts the plan relies on
| Thing | Fact | Where |
|---|---|---|
| DB | SQLite via `modernc.org/sqlite`. IDs are `TEXT` (UUID), timestamps are RFC3339 `TEXT`, booleans are `INTEGER 0/1` | `backend/go.mod`, `000001_init.up.sql` |
| Migrations | Embedded `migrations/*.sql`, applied in order on boot, **up-only** | `backend/internal/db/migrate.go` |
| Routing | Go 1.22 `http.ServeMux` patterns (`"GET /api/x/{id}"`), registered from `handler.Register` | `backend/internal/handler/handler.go` |
| JSON out | `writeJSON(w, status, v)` | `handler.go:13` |
| Pagination | `pagination(r)` → `page, size`; `offset(page, size)` | `handler/pagination.go` |
| Passwords | `auth.HashPassword` / `auth.VerifyPassword` (PHC string) | `backend/internal/auth/password.go` |
| Frontend data | TanStack Query (`src/queries.ts`) over `api` in `src/api.ts` | |
| Routing (FE) | TanStack Router, routes in `src/routes/*.tsx`, tree in `src/router.tsx` | |
| Sidebar | `MODULE_DEFINITIONS` in `src/modules.ts`; `hasScreen: false` → placeholder `/modules/$moduleKey` | |
| UI kit | `src/components/ui/*`. Behaviour comes from `@ui-sdk/react`, styles from `src/styles.css` (Tabs, Menu, Popover, Tooltip, Checkbox, Switch, Progress, Avatar, Accordion, Select, Dialog…) | |
| Identity | FE keeps a cache of the signed-in user in `localStorage` but hydrates from `GET /api/me` on boot. BE resolves the caller from the session cookie only — no `student_id` / `user_id` in a query or body and no `X-OptimoLMS-User` header decides who is calling (`handler/session.go`; `docs/STATUS.md` §1.1) | |

### 0.2 Conventions
- **Migration numbering** continues at `000019`. One migration per concern, named `0000NN_<concern>.up.sql`.
- **Handler file per domain**: `handler/<domain>.go` with a `register<Domain>(mux, db, …)` func called from `Register`.
- **Every new endpoint** gets a table-driven test in `handler/<domain>_test.go` that covers: 401 without a session, 403 with the wrong role/owner, 400 on bad input, and the happy path.
- **Errors** are `{"error": "<code>", "message": "<human text>"}`. The `code` is a stable snake_case string (needed for i18n in Sprint 8).
- **Dates**: store UTC RFC3339 and render in `Europe/Tirane` on the FE (`src/format.ts`).
- **FE**: every new list uses `Table` + `Pagination` + `States` (empty/error/loading). Every mutation uses a TanStack `useMutation`, a sonner toast and query invalidation.

### 0.3 Definition of Done (applies to every story)
1. `cd backend && go test ./...` is green.
2. `cd frontend && npm run typecheck && npm run build` is green.
3. New endpoints are listed in the README API table.
4. The UI works at 375 px width, in light and dark mode, keyboard only.
5. Seed data (`internal/db/seed*.go`) is extended so the feature is demo-able right after a fresh boot.
6. The demo script at the end of the sprint runs start to finish on a fresh DB.

### 0.4 Seed personas used in demos
| Persona | Role | Use |
|---|---|---|
| `student@optimolms.local` | Student, group IE301, enrolled in the 5 FALL 2026-27 courses | Every student flow |
| `student2@optimolms.local` | Student, same group | Cross-student access tests, messaging |
| `lecturer@optimolms.local` | Pedagog, lecturer of 2+ courses | Grading, announcements, uploads |
| `secretary@optimolms.local` | Secretary/staff | Service requests, re-exams, timetable |
| `admin@optimolms.local` | Admin | Everything |

Add any persona that's missing in Sprint 1, story 1.8.

---

## Sprint 1: Security baseline (weeks 1–2) · **BLOCKER**

> **Status 2026-11-21: the auth core has landed.** Stories 1.1 (minus the
> sliding timeout), 1.2, 1.3 (`GET /api/me`, `POST /api/auth/logout`) and 1.4/1.5
> are implemented in `backend/internal/handler/session.go` and the handlers it
> guards; `docs/STATUS.md` §1.1 records the mechanism and the leftovers (per-IP
> rate limiting, the `Origin` check, session listing, and personal access tokens
> for MCP — the session's bearer token stands in for those today). The task lists
> below are kept as the original plan.

**Sprint goal:** every API request is tied to a server-verified user. No endpoint trusts an id sent by the client.

### Story 1.1: Sessions table
Migration `000019_sessions.up.sql`:
```sql
CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,               -- uuid
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,           -- sha256(hex) of the raw cookie token
  created_at   TEXT NOT NULL,
  last_seen_at TEXT NOT NULL,
  expires_at   TEXT NOT NULL,                  -- absolute: created + 30d
  ip           TEXT,
  user_agent   TEXT,
  revoked_at   TEXT
);
CREATE INDEX idx_sessions_user ON sessions(user_id);
```
**Tasks**
- [ ] New package `backend/internal/session` with `Create(ctx, db, userID, ip, ua) (rawToken string, err)`, `Lookup(ctx, db, rawToken) (*Principal, error)`, `Revoke(ctx, db, rawToken)` and `RevokeAllForUser(ctx, db, userID, exceptID string)`.
- [ ] Raw token = 32 bytes from `crypto/rand`, base64url. Only the SHA-256 is stored.
- [ ] Sliding idle timeout of 12 h: `Lookup` rejects if `last_seen_at` is older than 12 h, and otherwise bumps it at most once a minute (avoids a write per request).
- [ ] `Principal{UserID, Email, Name, RoleID, RoleName, Permissions map[string]bool, SessionID}`. Permissions are loaded from `role_permissions` ∪ `user_permissions` (reuse the logic in `handler/user_permissions.go`).

**Acceptance:** unit tests cover create → lookup ok; expired → `ErrExpired`; revoked → `ErrRevoked`; idle > 12 h → `ErrExpired`.

### Story 1.2: Login and 2FA issue a cookie
**Files:** `handler/auth.go`, `handler/two_factor.go`, `internal/config/config.go`.
- [ ] After a successful `POST /api/auth/login` (no 2FA) or `POST /api/auth/login/2fa`, call `session.Create` and set:
  `Set-Cookie: optimolms_session=<raw>; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000` plus `Secure` when `config.CookieSecure` (env `COOKIE_SECURE`, default `true` outside dev).
- [ ] The response body stays `sessionPayload(...)` (the FE still needs name, role and modules), but the FE must no longer treat it as proof of auth.
- [ ] Rate limit stays as is (`000002_auth_lockout`).

### Story 1.3: `me` and `logout` endpoints
| Method | Path | Auth | Body | Response |
|---|---|---|---|---|
| GET | `/api/auth/me` | session | — | `200 sessionPayload` · `401 {"error":"unauthenticated"}` |
| POST | `/api/auth/logout` | session | — | `204`, revokes the session, clears the cookie (`Max-Age=0`) |
| GET | `/api/me/sessions` | session | — | `[{id, created_at, last_seen_at, ip, user_agent, current}]` (Moodle "Browser sessions") |
| DELETE | `/api/me/sessions/{id}` | session | — | `204`, owner only |

### Story 1.4: Auth middleware
**File:** new `handler/middleware.go`, wired in `cmd/server/main.go` around the mux.
- [ ] `withSession(db)` reads the cookie → `session.Lookup` → puts the `*Principal` in the context (`ctxKeyPrincipal`).
- [ ] Public allow-list: `GET /api/health`, `GET /api/meta`, `POST /api/auth/login`, `POST /api/auth/login/2fa`. Everything else under `/api/` returns **401** without a principal.
- [ ] Helpers: `principal(r) *session.Principal`, `requirePerm(key string, h http.HandlerFunc) http.HandlerFunc` (403 `{"error":"forbidden"}`), `isStaff(p)`.
- [ ] **CSRF**: on unsafe methods (POST/PUT/PATCH/DELETE), require `Origin` to equal the configured FE origin (the CORS origin already in `main.go:48`), otherwise 403. SameSite=Lax covers the rest.
- [ ] MCP (`/api/mcp`): keep bearer access for external MCP clients via a **personal access token** (see 1.6). Delete the `user_id` query and `X-OptimoLMS-User` paths (`mcp.go:79-82`).

### Story 1.5: Remove client-supplied identity everywhere
Audit with `grep -rn 'student_id\|user_id\|X-OptimoLMS-User' backend/internal/handler`. For each hit:

| Endpoint today | Change |
|---|---|
| `GET /api/assignments?student_id=` (`assignments.go:238`) | Student: use `principal.UserID`. Staff: `student_id` allowed only with `grades.view_all` |
| `POST /api/assignments/{id}/submissions` | `student_id` comes from the principal; ignore the body field |
| `PATCH /api/submissions/{id}` (grading) | `requirePerm("grades.manage")` + caller is the subject's lecturer or admin |
| `GET /api/students/{id}/grades`, `/grades/{subjectId}`, `/record`, `/submissions`, `/quiz-attempts` | `{id}` must equal the principal, unless the caller has `students.view_all`. Add alias `GET /api/me/...` for each |
| `POST /api/quizzes/{id}/attempts`, `POST /api/attempts/{id}/submit` | Attempt owner = principal; submit checks ownership |
| `POST /api/threads/{id}/posts`, `PATCH /api/threads/{id}`, `DELETE /api/posts/{id}` | Author = principal; edit/delete = author or staff |
| `POST /api/ai/chat` (`ai_chat.go:26`), `/api/ai/sessions*`, `/api/ai/settings` | Drop `user_id` from the body; use the principal |
| `/api/me/*` (appearance, two-factor, mcp-apps) | Already "me" in name. Make them read the principal instead of a parameter |
| Admin CRUD (users, roles, permissions, campuses, academic, school-years, AI providers) | Wrap in `requirePerm(...)` with the matching `*.manage` key |

**Permission keys to add** (`000020_permission_keys_v2.up.sql`, insert into `permissions`, grant via `role_permissions`):
`grades.view_all`, `grades.manage`, `students.view_all`, `content.manage`, `forums.moderate`, `announcements.post`, `timetable.manage`, `requests.process`, `reexams.manage`, `payments.manage`, `users.manage`, `academic.manage`.

### Story 1.6: Personal access tokens (for MCP)
Migration `000021_access_tokens.up.sql`: `access_tokens(id, user_id, name, token_hash UNIQUE, scopes TEXT, last_used_at, created_at, expires_at, revoked_at)`.
- [ ] `POST /api/me/tokens` returns the raw token **once**. `GET /api/me/tokens` lists them; `DELETE /api/me/tokens/{id}` revokes one.
- [ ] Middleware: `Authorization: Bearer slms_<token>` resolves a principal **only** for `/api/mcp*`.
- [ ] FE: "Access tokens" card inside `McpAppsPanel`.

### Story 1.7: Change password
| Method | Path | Body | Rules |
|---|---|---|---|
| POST | `/api/me/password` | `{current_password, new_password}` | Verify the current one with `auth.VerifyPassword`; new password ≥ 10 chars and different from the current; hash it; `RevokeAllForUser(except current)`; 204. Errors: `invalid_current_password`, `weak_password` |

FE: `ChangePasswordCard` in `routes/settings.tsx` → profile tab, using `TextField` + `@tanstack/react-form`.

### Story 1.8: Frontend auth rewrite
**Files:** `src/api.ts`, `src/auth.tsx`, `src/routes/root.tsx`, `src/components/UserMenu.tsx`.
- [ ] `request()` (`api.ts:435`): add `credentials: "include"`. On 401, call `auth.signOut({ reason: "expired" })`, which clears the query cache and navigates to `/login?next=<path>`.
- [ ] `auth.tsx`: stop persisting the user object as the source of truth. On boot, call `GET /api/auth/me`. While it's pending, render a full-screen `Spinner`. Cache only `appearance` locally (avoids theme flash).
- [ ] Remove every `user_id` / `student_id` the FE puts into requests (`grep -n "student_id\|user_id" src`).
- [ ] `UserMenu`: add "Sessions" (→ settings/profile#sessions) and "Log out" (`POST /api/auth/logout`). Build it on the new `Menu` component.
- [ ] Seed: make sure every persona in §0.4 exists, with password `Password123!` in dev only.

### Sprint 1 tests (minimum)
- `middleware_test.go`: public routes are reachable; a private route returns 401; a bad Origin on POST returns 403.
- `assignments_test.go`: student A cannot see student B's submissions (403); staff with `grades.view_all` can.
- `auth_test.go`: login sets the cookie; `/me` works with the cookie; logout → `/me` returns 401; password change revokes other sessions.

### Sprint 1 demo script
1. Fresh DB → log in as `student`. Check in DevTools that the cookie is HttpOnly.
2. `curl /api/students/<student2-id>/grades` with student's cookie → **403**.
3. `curl /api/subjects` with no cookie → **401**.
4. Change password → a second browser is logged out.
5. Create an access token → `curl -H "Authorization: Bearer …" /api/mcp/tools` → 200.

---

## Sprint 2: My courses and the course page (weeks 3–4)

**Sprint goal:** a student lands on the dashboard, sees "My courses" grouped like Moodle, and opens a course page with Course · Participants · Grades · Forums tabs.

### Story 2.1: Student profile fields
Migration `000022_student_identity.up.sql`:
```sql
ALTER TABLE programme_enrollments ADD COLUMN student_code TEXT;          -- e.g. 53055
ALTER TABLE programme_enrollments ADD COLUMN group_code   TEXT;          -- e.g. IE301
ALTER TABLE programme_enrollments ADD COLUMN profile_name TEXT;          -- e.g. Software Design
CREATE UNIQUE INDEX idx_pe_student_code ON programme_enrollments(student_code) WHERE student_code IS NOT NULL;
ALTER TABLE users ADD COLUMN avatar_file_id TEXT;                         -- filled in Sprint 3
ALTER TABLE users ADD COLUMN phone TEXT;
```
- [ ] `GET /api/me/profile` → `{user:{id,name,email,phone,avatar_url}, enrollment:{programme, level(BA/MA/DR), profile_name, student_code, group_code, year_of_study, status, school_year}}`.
- [ ] `PATCH /api/me/profile` → `{phone?}` only (name and email are staff-managed).
- [ ] Staff: extend `ProgrammeEnrollment` PATCH (`/api/programme-enrollments/{id}`) with the 3 new fields and validate `group_code ~ ^[A-Z]{2,4}\d{3}$`.
- [ ] FE: new `ProfileHeader` card (Avatar + name + code + group + status `Badge`) shown on `routes/dashboard.tsx` and settings/profile.

### Story 2.2: `GET /api/me/subjects`
Query params: `school_year` (default: the active one from `school_years`), `semester` (`FIRST|SECOND|all`), `q`, `sort` (`name|recent`).
Response:
```json
{
  "groups": [
    { "school_year": "2026/2027", "semester": "FIRST",
      "subjects": [
        { "id": "…", "code": "CIS260.e", "name": "Data Communication",
          "lecturer": {"id":"…","name":"…"},
          "progress": 0.42,               // completions / completable items (0 until Sprint 4)
          "last_accessed_at": "…|null",   // Sprint 5 recent_items, null until then
          "current_week": 7 }
      ] }
  ],
  "other": [ /* subjects with no school_year, e.g. NjoftimeStudentet */ ]
}
```
SQL source: `enrollments e JOIN subjects s` filtered by `e.student_id = principal`. Staff variant: subjects where `lecturer_id = principal`.

### Story 2.3: "My courses" page
- [ ] Route `src/routes/my-courses.tsx` at `/my/courses`, added to `router.tsx` and to `MODULE_DEFINITIONS` as `{key:"my_courses", group:"learning", label:"My courses", icon: Books}`.
- [ ] Toolbar: `SearchField` (debounced 250 ms, filters client-side), `Select` for semester, `Select` for sort, and a card/list toggle using `SegmentedControl` (ui-sdk; add a wrapper like the others). Save the toggle in `localStorage['myCourses.view']`.
- [ ] Card: course code chip, name, lecturer, `Progress` bar, "Week N" badge. The whole card links to `/subjects/$subjectId`.
- [ ] Group headings: "Viti Akademik 2026-2027 · Semestri 1", then an "Other" section.
- [ ] States: skeleton grid of 6 while loading; empty state "You're not enrolled in any courses this semester".
- [ ] Dashboard: replace or extend the current courses block with the first 6 cards and a "View all" link.

### Story 2.4: Course page with tabs
**File:** `src/routes/subject-detail.tsx` (split into `src/components/subjects/tabs/*.tsx`).
- [ ] Use the shared `Tabs` component. Tab values: `course | participants | grades | forums | downloads`. Sync the active tab to the URL search param `?tab=` (TanStack Router `validateSearch`).
- [ ] Header: code, name, lecturer `Avatar`, semester `Badge`, and a staff-only "Edit" `Menu` (edit, add week, add resource, add assignment, add quiz).
- [ ] **Course tab**: weeks rendered with the shared `Accordion` (reuse `WeeksPanel` content). The "General" section (week 0 / no week) is pinned at the top. The current week (`starts_on ≤ today ≤ ends_on`) is open by default, gets a "Current week" `Badge`, and is scrolled into view on first load.
- [ ] **Grades tab**: reuse `SubjectGradeView` for students and `GradebookPanel` for staff.
- [ ] **Forums tab**: reuse `ForumPanel`.
- [ ] **Downloads tab**: placeholder until Sprint 3 (disabled tab with a tooltip "Available soon").

### Story 2.5: Participants
| Method | Path | Query | Response |
|---|---|---|---|
| GET | `/api/subjects/{id}/participants` | `role=student|lecturer|all`, `group`, `q`, `page`, `size` | `{items:[{id,name,email,role,group_code,avatar_url,last_access_at}], total}` |
| GET | `/api/subjects/{id}/participants.csv` | same | `text/csv` attachment, UTF-8 with BOM (so Excel shows "ë/ç" correctly) |

- Access: enrolled students see names, roles and groups only (no email). Staff see everything.
- [ ] FE Participants tab: `Table` with an Avatar column, filters (role `Select`, group `Select`, `SearchField`), `Pagination`, and a staff-only "Export CSV" button.

### Sprint 2 tests
- `me_subjects_test.go`: grouping by year and semester; "other" bucket; a student only sees enrolled subjects; lecturer variant.
- `participants_test.go`: a non-enrolled student gets 403; email is hidden for students; the CSV has a BOM and a header row.

### Sprint 2 demo script
Log in as student → dashboard shows the profile header (53055 · IE301 · ACTIVE) → "View all" → My courses grouped under 2026-2027 Sem 1 → open Data Communication → current week is open → Participants tab → Grades tab.

---

## Sprint 3: Files and resources (weeks 5–6)

**Sprint goal:** real file storage. Lecturers publish materials per week and students upload assignment files.

### Story 3.1: Storage layer
- [ ] Package `backend/internal/storage` with `type Store interface { Put(ctx, key string, r io.Reader, size int64, mime string) error; Get(ctx, key) (io.ReadCloser, error); Delete(ctx, key) error }`.
- [ ] `LocalStore{Root}` (default `./data/files`, env `FILES_DIR`). Keys look like `yyyy/mm/<uuid>`, so there's no user input in paths.
- [ ] Leave an S3/R2 implementation as a stub interface for later.

Migration `000023_files.up.sql`:
```sql
CREATE TABLE files (
  id          TEXT PRIMARY KEY,
  owner_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  storage_key TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL,        -- original filename, sanitised
  mime        TEXT NOT NULL,
  size        INTEGER NOT NULL,
  sha256      TEXT NOT NULL,
  scope       TEXT NOT NULL,        -- private | resource | submission | avatar | request
  created_at  TEXT NOT NULL,
  CHECK (scope IN ('private','resource','submission','avatar','request'))
);
CREATE INDEX idx_files_owner ON files(owner_id, scope);
```

### Story 3.2: Upload and download endpoints
| Method | Path | Notes |
|---|---|---|
| POST | `/api/files` | `multipart/form-data`, fields `file` and `scope`. `http.MaxBytesReader` at **100 MB** (UET's limit). Sniff the MIME with `http.DetectContentType` and reject executables (`application/x-msdownload`, `x-sh`, …). Compute sha256 while streaming. Returns `{id,name,mime,size,url}` |
| GET | `/api/files/{id}` | Access check (below); `Content-Disposition: attachment; filename*=UTF-8''…`; `X-Content-Type-Options: nosniff`; supports `Range` |
| GET | `/api/files/{id}?inline=1` | Inline for PDF and images only |
| DELETE | `/api/files/{id}` | Owner only. 409 `file_in_use` if referenced |

**Access rule** (`files.CanRead(p, file)`): owner, **or** a resource in a subject the principal is enrolled in or teaches, **or** a submission the principal grades, **or** an avatar (any logged-in user), **or** staff with `requests.process` for scope `request`.

### Story 3.3: Submissions use real files
Migration `000024_submission_files.up.sql`:
```sql
CREATE TABLE submission_files (
  submission_id TEXT NOT NULL REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  file_id       TEXT NOT NULL REFERENCES files(id) ON DELETE RESTRICT,
  PRIMARY KEY (submission_id, file_id)
);
ALTER TABLE assignments ADD COLUMN max_files INTEGER NOT NULL DEFAULT 5;
ALTER TABLE assignments ADD COLUMN accepted_types TEXT;      -- ".pdf,.docx,.pkt"
ALTER TABLE assignments ADD COLUMN allow_resubmit INTEGER NOT NULL DEFAULT 1;
```
- [ ] `POST /api/assignments/{id}/submissions` body `{content?, file_ids: []}`. Validate the count ≤ `max_files`, extensions ⊂ `accepted_types`, and that each file is owned by the principal with scope `submission`. Status is `late` if now > `due_at`.
- [ ] Keep `file_url` read-only for legacy rows. The migration copies nothing.
- [ ] FE `assignment-detail.tsx`: drop zone built on ui-sdk `file-input` (new wrapper `components/ui/FileDrop.tsx`), per-file upload progress (`XMLHttpRequest` upload events, `Progress` component), remove-before-submit, and a status line ("Submitted for grading · 23 Nov 14:02 · Late by 2h").
- [ ] Lecturer grading view: list the files with download links, and add "Download all submissions" (zip, story 3.6).

### Story 3.4: Generic course resources
Migration `000025_resources.up.sql`:
```sql
CREATE TABLE resources (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  week_id     TEXT REFERENCES course_weeks(id) ON DELETE SET NULL,  -- NULL = General
  parent_id   TEXT REFERENCES resources(id) ON DELETE CASCADE,      -- items inside a folder
  kind        TEXT NOT NULL,          -- file | folder | url | page
  title       TEXT NOT NULL,
  description TEXT,
  file_id     TEXT REFERENCES files(id) ON DELETE RESTRICT,
  url         TEXT,
  body_md     TEXT,                   -- for kind=page
  position    INTEGER NOT NULL DEFAULT 0,
  visible     INTEGER NOT NULL DEFAULT 1,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  CHECK (kind IN ('file','folder','url','page')),
  CHECK ((kind='file' AND file_id IS NOT NULL) OR (kind='url' AND url IS NOT NULL) OR kind IN ('folder','page'))
);
CREATE INDEX idx_resources_subject_week ON resources(subject_id, week_id, position);
```
| Method | Path | Perm |
|---|---|---|
| GET | `/api/subjects/{id}/resources?week_id=` | enrolled or teaching. Hidden items are filtered out for students |
| POST | `/api/subjects/{id}/resources` | `content.manage` + lecturer of the subject |
| PATCH | `/api/resources/{id}` | same |
| DELETE | `/api/resources/{id}` | same |
| POST | `/api/subjects/{id}/resources/reorder` | `{week_id, ids:[...]}`, same |

- `GET /api/subjects/{id}/weeks` now embeds `items: [...]` per week, merged and sorted by `position`: resources + lectures + assignments + quizzes, each as `{type, id, title, meta}`.
- [ ] FE: `WeeksPanel` renders an icon per type (Phosphor: `FilePdf`, `FileDoc`, `FilePpt`, `Folder`, `Link`, `Article`, `Exam`, `ClipboardText`). Staff get inline "Add item" `Menu`, drag-to-reorder (native HTML DnD + keyboard Up/Down buttons for accessibility) and a visibility `Switch`.
- [ ] `ResourceFormDialog.tsx`: the kind changes which fields show (file uses `FileDrop`; url validates `https?://`; page uses a markdown `TextArea` with preview through `chat/Markdown.tsx`).
- [ ] Seed: for each seeded course, add a Syllabus PDF and 2 URLs in General, plus 1 lecture file and 1 folder per week for the first 4 weeks (small generated PDFs).

### Story 3.5: Avatars
- [ ] `PUT /api/me/avatar` `{file_id}` (scope `avatar`, image/* ≤ 2 MB) and `DELETE /api/me/avatar`. The shared `Avatar` component gets `src` from `avatar_url`.

### Story 3.6: Zip downloads
- [ ] `GET /api/subjects/{id}/download.zip` streams with `archive/zip` (no temp file). Folder structure is `<Course>/<NN - Week title>/<file>`. Visible resources only. Limit 1 GB, else 413.
- [ ] `GET /api/assignments/{id}/submissions.zip` (lecturer) → `<group>/<student name - code>/<files>`.
- [ ] FE Downloads tab: tree of resources with checkboxes (shared `Checkbox`, indeterminate for folders), "Download selected" (`?ids=` param) and "Download everything".

### Story 3.7: Private files
- [ ] Migration `000026_user_quota.up.sql`: `ALTER TABLE users ADD COLUMN quota_bytes INTEGER NOT NULL DEFAULT 204472320;` (195 MB, as on UET).
- [ ] `GET /api/me/files?scope=private` → `{items, used_bytes, quota_bytes}`. Uploads with scope `private` return 413 `quota_exceeded` when over quota.
- [ ] Route `/files`: `Progress` quota bar, `FileDrop`, table (name, size, date, a `Menu` with download/rename/delete). Rename = `PATCH /api/files/{id} {name}`.

### Sprint 3 tests
Upload over 100 MB → 413; an `.exe` → 415; a non-enrolled student downloading a resource → 403; a student downloading another student's submission → 403; zip of 3 files has the expected paths; quota is enforced.

### Sprint 3 demo script
Lecturer uploads "Lecture 7.pptx" to week 7 → student sees it under the current week → downloads it → submits 2 files to "Seminar 7" → lecturer downloads the submissions zip → student downloads the whole course zip → student uploads to private files and sees the quota move.

---

## Sprint 4: Learning activities (weeks 7–8)

**Sprint goal:** students can do every activity in the browser. No sidebar item lands on a placeholder.

### Story 4.1: Activity completion
Migration `000027_completions.up.sql`:
```sql
CREATE TABLE activity_completions (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_type    TEXT NOT NULL,     -- resource | lecture | assignment | quiz | flashcard_deck
  item_id      TEXT NOT NULL,
  subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  source       TEXT NOT NULL,     -- manual | auto
  completed_at TEXT NOT NULL,
  PRIMARY KEY (user_id, item_type, item_id)
);
CREATE INDEX idx_completions_subject ON activity_completions(user_id, subject_id);
```
- [ ] Rules: **manual** for resource and lecture ("Mark as done"); **auto** for an assignment on submit, a quiz on a passing attempt (≥ pass mark, else on any finished attempt), and a flashcard deck once every card has been reviewed.
- [ ] `PUT /api/me/completions/{item_type}/{item_id}` (manual only) → 204. `DELETE` the same → 204.
- [ ] `GET /api/me/subjects/{id}/progress` → `{completed, total, ratio, by_week:[{week_id, completed, total}]}`.
- [ ] `/api/me/subjects` `progress` now uses real data.
- [ ] FE: a "Mark as done" toggle button per week item (`aria-pressed`, shows a check when done), a `Progress` bar in the course header, a mini bar on each week's `Accordion` meta ("3/5"), and progress on the My courses cards.
- [ ] Staff: `GET /api/subjects/{id}/completion-report` returns a matrix of students × items. Show it as a table under a staff-only tab "Progress" with CSV export.

### Story 4.2: Taking a quiz
Existing: `GET /api/quizzes/{id}/questions`, `POST /api/quizzes/{id}/attempts`, `POST /api/attempts/{id}/submit`, `GET /api/quizzes/{id}/attempts`.
Gaps to close in the backend first:
- [ ] Migration `000028_quiz_settings.up.sql`: `ALTER TABLE quizzes ADD COLUMN opens_at TEXT; closes_at TEXT; time_limit_min INTEGER; max_attempts INTEGER NOT NULL DEFAULT 1; pass_mark REAL; shuffle INTEGER NOT NULL DEFAULT 0; review_mode TEXT NOT NULL DEFAULT 'after_close';` (review_mode: `immediate|after_close|never`).
- [ ] `POST /attempts` rejects when the quiz is outside its window (`quiz_closed`) or attempts are used up (`no_attempts_left`). It stores `started_at` and returns `{attempt_id, deadline_at}`.
- [ ] Questions are served **without** correct answers to students. Add `PUT /api/attempts/{id}/answers` `{question_id, answer}` autosave (debounced 1 s on the FE). Submit after `deadline_at + 30 s` grace is graded with what was saved.
- [ ] `GET /api/attempts/{id}` → the review payload, which includes correct answers only when `review_mode` allows.

FE route `src/routes/quiz-attempt.tsx` at `/quizzes/$quizId/attempt`:
- [ ] **Intro screen**: title, window, time limit, attempts used/allowed, best grade, "Start attempt" (confirm dialog when time-limited).
- [ ] **Attempt screen**: one question per page plus a question navigator grid (answered / flagged / current). Countdown in the header (`aria-live="polite"` announcements at 5 and 1 minutes). Autosave indicator ("Saved · 14:02"). "Finish attempt" → summary with unanswered warnings → submit.
- [ ] Question types already in `quiz_questions`: render single choice (`Radio` group) and multiple choice (`Checkbox`). Add true/false and short text if the schema supports them; otherwise note it as follow-up.
- [ ] **Review screen**: score, pass/fail `Badge`, per-question correct/incorrect (respecting `review_mode`).
- [ ] Leaving the page mid-attempt shows a `beforeunload` warning. Reopening resumes the attempt.

### Story 4.3: Cross-course module screens (replace placeholders)
For each one: create the route, set `hasScreen: true` and point `route` at it in `modules.ts`.

| Module | Route | Endpoint (new) | Content |
|---|---|---|---|
| Lectures | `/lectures` | `GET /api/me/lectures?subject=&from=&to=` | Table: date, course, title, room, materials link, done ✓ |
| Quizzes | `/quizzes` | `GET /api/me/quizzes?status=open|upcoming|closed` | Cards: course, window, attempts, best grade, "Attempt" CTA |
| Flashcards | `/flashcards` | `GET /api/me/flashcard-decks` | Decks per course with card count, mastery %, "Study" |
| Forums | `/forums` | `GET /api/me/forums` | All forums from enrolled courses: unread count, last post, subscribe `Switch` |

### Story 4.4: Flashcard study mode
- [ ] Migration `000029_flashcard_reviews.up.sql`: `flashcard_reviews(user_id, flashcard_id, ease REAL DEFAULT 2.5, interval_days INTEGER DEFAULT 0, due_on TEXT, reps INTEGER DEFAULT 0, last_grade INTEGER, PRIMARY KEY(user_id, flashcard_id))`.
- [ ] SM-2 scheduling in `internal/srs` with unit tests. `GET /api/subjects/{id}/flashcards/due` and `POST /api/flashcards/{id}/review {grade: 0..5}`.
- [ ] FE `/flashcards/$subjectId/study`: card flip (CSS 3D, reduced-motion falls back to a crossfade), keyboard Space = flip and 1–4 = Again/Hard/Good/Easy, a session summary at the end.

### Story 4.5: Forum improvements (Moodle parity)
- [ ] Migration `000030_forum_reads.up.sql`: `forum_subscriptions(user_id, forum_id, PK)`, `forum_reads(user_id, thread_id, last_read_post_id, read_at, PK(user_id,thread_id))`.
- [ ] `PUT/DELETE /api/forums/{id}/subscription`. Unread counts in thread lists. New posts notify subscribers (insert into `notifications`).
- [ ] FE `ForumPanel`: unread dot, "Mark all read", subscribe toggle.

### Sprint 4 tests
`srs_test.go` intervals; quiz window, attempt limits, deadline grace, answers hidden from students; completion auto-rules fire on submit; manual completion rejected for an assignment (400 `auto_only`).

### Sprint 4 demo script
Student marks the syllabus as done → progress 1/12 → takes "Quiz 2" with a timer → reloads mid-attempt and resumes → submits → reviews → progress updates → studies flashcards → opens /forums and sees unread counts.

---

## Sprint 5: Timetable, calendar and dashboard (weeks 9–10)

**Sprint goal:** students know where to be and what's due. The dashboard matches Moodle's timeline and recent items.

### Story 5.1: Timetable model
Migration `000031_timetable.up.sql`:
```sql
CREATE TABLE class_groups (
  code          TEXT PRIMARY KEY,                    -- IE301
  programme_id  TEXT REFERENCES programmes(id) ON DELETE SET NULL,
  school_year   TEXT NOT NULL,
  year_of_study INTEGER NOT NULL
);
CREATE TABLE timetable_slots (
  id           TEXT PRIMARY KEY,
  school_year  TEXT NOT NULL,                        -- 2026/2027
  semester     TEXT NOT NULL,                        -- FIRST | SECOND
  subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  kind         TEXT NOT NULL,                        -- lecture | seminar | lab
  weekday      INTEGER NOT NULL,                     -- 1=Mon … 7=Sun
  start_time   TEXT NOT NULL,                        -- HH:MM
  end_time     TEXT NOT NULL,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL,   -- room
  teacher_id   TEXT REFERENCES users(id) ON DELETE SET NULL,
  published    INTEGER NOT NULL DEFAULT 0,           -- "frozen" timetable on UET
  created_at   TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (kind IN ('lecture','seminar','lab')),
  CHECK (weekday BETWEEN 1 AND 7),
  CHECK (start_time < end_time)
);
CREATE TABLE timetable_slot_groups (
  slot_id    TEXT NOT NULL REFERENCES timetable_slots(id) ON DELETE CASCADE,
  group_code TEXT NOT NULL REFERENCES class_groups(code) ON DELETE CASCADE,
  PRIMARY KEY (slot_id, group_code)
);
```
| Method | Path | Perm | Notes |
|---|---|---|---|
| GET | `/api/me/timetable?school_year=&semester=` | session | Student: slots for their `group_code`, published only. Lecturer: slots where `teacher_id` = principal |
| GET | `/api/timetable?school_year=&semester=&group=&teacher=&room=` | `timetable.manage` | Includes drafts |
| POST/PATCH/DELETE | `/api/timetable/slots[/{id}]` | `timetable.manage` | **Conflict check**: same room or teacher or group overlapping on the same weekday → 409 `{error:"conflict", conflicts:[...]}`, unless `force=true` |
| POST | `/api/timetable/publish` | `timetable.manage` | `{school_year, semester}` → sets published, notifies affected students |

- [ ] FE `/timetable`: week grid Mon–Fri 08:00–20:00 (CSS grid with rows per 30 min; slots positioned by time). Colour per subject (hash → token palette). Kind `Badge`. `Tooltip` with room and teacher. A list view on mobile (< 640 px). "Print" button + `@media print` stylesheet (A4 landscape, no sidebar).
- [ ] Staff `/timetable/manage`: filters (group, teacher, room), click an empty cell to create, dialog with a conflict warning list, and a publish button with a confirm dialog.
- [ ] Seed: group IE301 with the 10 weekly slots for the 5 courses (matching the UET crawl), published.

### Story 5.2: Events and calendar
Migration `000032_events.up.sql`:
```sql
CREATE TABLE events (
  id          TEXT PRIMARY KEY,
  scope       TEXT NOT NULL,                 -- user | subject | site
  owner_id    TEXT REFERENCES users(id) ON DELETE CASCADE,
  subject_id  TEXT REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  starts_at   TEXT NOT NULL,
  ends_at     TEXT,
  all_day     INTEGER NOT NULL DEFAULT 0,
  created_at  TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (scope IN ('user','subject','site'))
);
CREATE INDEX idx_events_range ON events(starts_at);
ALTER TABLE users ADD COLUMN calendar_token TEXT;   -- secret for the iCal feed URL
```
- [ ] `GET /api/me/events?from=&to=&subject=` returns a **union**, normalised as `{id, source, title, starts_at, ends_at, subject:{id,code,name}|null, url}`:
  - `events` (own user + enrolled subjects + site)
  - `assignments.due_at` → source `assignment_due` (url `/assignments/{id}`)
  - `quizzes.opens_at / closes_at` → `quiz_open` / `quiz_close`
  - timetable slots expanded across the range → `class` (optional, `include_classes=1`)
  - re-exam season deadlines (Sprint 7) → `reexam_deadline`
- [ ] `POST/PATCH/DELETE /api/events[/{id}]`: scope `user` for anyone; `subject` needs to be the lecturer; `site` needs `users.manage`.
- [ ] `POST /api/me/calendar-token` (rotate) → returns `https://<host>/api/calendar/<token>.ics`. `GET /api/calendar/{token}.ics` is **public by token** (whitelisted in the middleware) and serves RFC 5545 VEVENTs with `VTIMEZONE Europe/Tirane`.
- [ ] FE `/calendar` (replace "Events" in the Moodle nav):
  - Month grid using ui-sdk `calendar` (new wrapper `components/ui/Calendar.tsx`) with event dots coloured by source.
  - Side list "Upcoming" with filters: All / Overdue / Next 7 days / Next 30 days / Next 3 months / Next 6 months, plus a course `Select`.
  - "New event" dialog (ui-sdk `date-picker` and `time-input` wrappers).
  - "Import or export" `Popover`: shows the iCal URL with a copy button, plus "Regenerate".

### Story 5.3: Dashboard timeline and recent items
Migration `000033_recent_items.up.sql`: `recent_items(user_id, item_type, item_id, subject_id, accessed_at, PRIMARY KEY(user_id,item_type,item_id))`.
- [ ] Write: `POST /api/me/recent {item_type, item_id}`, fired by the FE on course and activity page mount, throttled to once per item per 5 min.
- [ ] `GET /api/me/recent?limit=6`.
- [ ] `GET /api/me/timeline?range=7|30|90|180&overdue=1&q=&type=` → assignments and quizzes requiring action (not submitted, or open and not attempted), sorted by date. Matches Moodle's "Timeline" block.
- [ ] Dashboard layout (`routes/dashboard.tsx`), top to bottom:
  1. `ProfileHeader`
  2. "Recently accessed" horizontal scroller of cards
  3. Two columns: **Timeline** (range `Select`, sort `Select`, search, grouped by date, empty state "No activities require action") | **Mini calendar** (current month, dots) + **Today's classes** from the timetable
  4. "My courses" grid (first 6)
  5. "Site news" (Sprint 6)

### Sprint 5 tests
Timetable conflict detection (room, teacher, group); students only see published slots; events union includes assignment deadlines; the iCal output validates (parse it back with a Go ics lib in the test); timeline excludes submitted items.

### Sprint 5 demo script
Secretary publishes the IE301 timetable → student opens /timetable → prints → dashboard shows "Seminar 7 is due · 23 Nov" in the timeline → open the calendar, filter Next 7 days → copy the iCal URL into Apple/Google Calendar → the events appear.

---

## Sprint 6: Communication (weeks 11–12)

**Sprint goal:** announcements reach students, students and staff can message each other, and users control notifications.

### Story 6.1: Announcement forums and site news
Migration `000034_forum_kinds.up.sql`:
```sql
ALTER TABLE forums ADD COLUMN kind TEXT NOT NULL DEFAULT 'general';  -- general | announcements | news
CREATE TABLE site_forums (forum_id TEXT PRIMARY KEY REFERENCES forums(id) ON DELETE CASCADE);
```
(Site news needs `forums.subject_id` to be nullable. SQLite can't drop NOT NULL in place, so the migration must **rebuild** `forums` with the copy-table pattern, as `000010` did for quiz attempts.)
- [ ] Every subject auto-gets one `announcements` forum on create, plus a backfill in the migration.
- [ ] Only users with `announcements.post` who teach the subject can create threads in `announcements`. Students can't reply (the forum is locked for replies).
- [ ] A new announcement inserts a `notifications` row for every enrolled student, in one transaction (batch insert). Also covered by the email channel (6.3).
- [ ] `GET /api/site-news?limit=5` and `POST /api/site-news` (`users.manage`).
- [ ] FE: the announcements forum is pinned first in the Forums tab with a megaphone icon. Dashboard "Site news" card. Notification click deep-links to the thread.

### Story 6.2: Direct messaging
Migration `000035_messaging.up.sql`:
```sql
CREATE TABLE conversations (
  id          TEXT PRIMARY KEY,
  kind        TEXT NOT NULL,          -- private | group
  title       TEXT,                   -- group only
  subject_id  TEXT REFERENCES subjects(id) ON DELETE CASCADE,  -- course group chats
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  last_message_at TEXT
);
CREATE TABLE conversation_members (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id         TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  last_read_at    TEXT,
  starred         INTEGER NOT NULL DEFAULT 0,
  muted           INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (conversation_id, user_id)
);
CREATE TABLE messages (
  id              TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  file_id         TEXT REFERENCES files(id) ON DELETE SET NULL,
  created_at      TEXT NOT NULL,
  edited_at       TEXT,
  deleted_at      TEXT
);
CREATE INDEX idx_messages_conv ON messages(conversation_id, created_at);
CREATE TABLE contacts (user_id TEXT, contact_id TEXT, created_at TEXT, PRIMARY KEY(user_id, contact_id));
CREATE TABLE blocked_users (user_id TEXT, blocked_id TEXT, PRIMARY KEY(user_id, blocked_id));
```
| Method | Path | Notes |
|---|---|---|
| GET | `/api/conversations?filter=all|starred|group|private&q=` | With unread count and last message preview |
| POST | `/api/conversations` | `{kind:"private", user_id}` is idempotent (returns the existing one). Group needs staff, or a subject group |
| GET | `/api/conversations/{id}/messages?before=<id>&limit=30` | Cursor pagination, newest first |
| POST | `/api/conversations/{id}/messages` | `{body ≤ 4000, file_id?}`. Rate limit 20/min/user |
| PATCH/DELETE | `/api/messages/{id}` | Own message within 15 min; delete is soft |
| PUT | `/api/conversations/{id}/read` | Sets `last_read_at` |
| PUT | `/api/conversations/{id}/star` / `mute` | `{value: bool}` |
| GET | `/api/me/contacts`, PUT/DELETE `/api/me/contacts/{userId}`, PUT/DELETE `/api/me/blocked/{userId}` | |
| GET | `/api/users/search?q=` | Messaging people search: people sharing a course, plus staff |
| GET | `/api/me/stream` | **SSE**: `event: message`, `event: notification`, `event: unread`. Heartbeat every 25 s. One goroutine per connection, fed by an in-process broker (`internal/realtime`, map of user → channels) |

- **Privacy rule**: students can message only people who share a subject with them, or staff. Blocked users get 403 `blocked`.
- [ ] FE `/messages`: two-pane layout (list | thread), stacked on mobile. Filter `Tabs` (All/Starred/Group/Private), people `SearchField`, message composer (Enter sends, Shift+Enter adds a newline, attach via `FileDrop`), day separators, read state, infinite scroll upward.
- [ ] Shell: a messages icon with an unread badge in the top bar opens a ui-sdk `drawer` (new wrapper) with recent conversations.
- [ ] `src/realtime.ts`: one `EventSource('/api/me/stream', {withCredentials:true})` that invalidates the matching TanStack queries and reconnects with backoff.

### Story 6.3: Notification preferences and email channel
Migration `000036_notification_prefs.up.sql`:
```sql
ALTER TABLE notifications ADD COLUMN kind TEXT NOT NULL DEFAULT 'general';
ALTER TABLE notifications ADD COLUMN link TEXT;
CREATE TABLE notification_prefs (
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  kind    TEXT NOT NULL,       -- announcement | forum_post | message | grade | assignment_due | request_status | reexam
  channel TEXT NOT NULL,       -- web | email
  enabled INTEGER NOT NULL,
  PRIMARY KEY (user_id, kind, channel)
);
```
- [ ] `internal/notify.Send(ctx, userID, kind, title, msg, link)` is the **single** entry point: it checks prefs, inserts the web row, publishes to SSE, and enqueues email.
- [ ] Email: `internal/mailer` interface with `SMTPMailer` (env `SMTP_*`) and `LogMailer` (dev). The queue is an `email_outbox` table plus a worker goroutine with retry and backoff.
- [ ] `GET/PUT /api/me/notification-prefs` returns the matrix kind × channel with defaults.
- [ ] Scheduler goroutine (ticks hourly): an `assignment_due` reminder 24 h before `due_at` for students who haven't submitted (idempotent via a `reminders_sent` table).
- [ ] FE settings → new "Notifications" tab: a table of kinds × (Web, Email) shared `Switch`es. The notification bell dropdown gains "Preferences" and "Mark all read".

### Sprint 6 tests
The announcement fan-out count equals the enrolled count; a student can't post in announcements; messaging privacy and block rules; the SSE handler sends a heartbeat and the message event (`httptest` with a flusher); prefs suppress email but not web when configured; the due reminder is sent once.

### Sprint 6 demo script
Lecturer posts an announcement → the student's bell updates live (SSE) and an email appears in the dev log → student messages the lecturer from the Participants tab → the lecturer replies → the unread badge clears → student turns off forum emails → the next forum post produces web only.

---

## Sprint 7: Student services (weeks 13–14)

**Sprint goal:** replace UET's `local/sherbimet`, `local/riprovimet` and `local/student` plugins with first-class features.

### Story 7.1: Service catalogue and requests (Shërbimet)
Migration `000037_service_requests.up.sql`:
```sql
CREATE TABLE service_types (
  key              TEXT PRIMARY KEY,           -- change_group, reassessment, …
  name_sq          TEXT NOT NULL,
  name_en          TEXT NOT NULL,
  description_sq   TEXT, description_en TEXT,
  form_schema      TEXT NOT NULL,              -- JSON: [{name,label_sq,label_en,type:text|textarea|select|subject|file|date,required,options?}]
  requires_payment INTEGER NOT NULL DEFAULT 0,
  fee_amount       INTEGER,                    -- in ALL, minor units not needed
  sla_days         INTEGER NOT NULL DEFAULT 5,
  active           INTEGER NOT NULL DEFAULT 1,
  position         INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE service_requests (
  id           TEXT PRIMARY KEY,
  number       TEXT NOT NULL UNIQUE,           -- REQ-2026-000123
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type_key     TEXT NOT NULL REFERENCES service_types(key),
  payload      TEXT NOT NULL,                  -- JSON answers validated against form_schema
  status       TEXT NOT NULL DEFAULT 'submitted', -- submitted | in_review | needs_info | approved | rejected | cancelled
  assignee_id  TEXT REFERENCES users(id) ON DELETE SET NULL,
  staff_note   TEXT,
  result_file_id TEXT REFERENCES files(id) ON DELETE SET NULL,  -- e.g. the issued certificate (Vërtetim)
  created_at   TEXT NOT NULL, updated_at TEXT NOT NULL, closed_at TEXT,
  CHECK (status IN ('submitted','in_review','needs_info','approved','rejected','cancelled'))
);
CREATE TABLE service_request_events (
  id TEXT PRIMARY KEY, request_id TEXT NOT NULL REFERENCES service_requests(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES users(id), from_status TEXT, to_status TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL
);
CREATE TABLE service_request_files (request_id TEXT REFERENCES service_requests(id) ON DELETE CASCADE, file_id TEXT REFERENCES files(id), PRIMARY KEY(request_id,file_id));
```
**State machine** (enforced in `internal/requests`, unit-tested):
`submitted → in_review | rejected | cancelled(student)` · `in_review → needs_info | approved | rejected` · `needs_info → in_review (student responds) | cancelled` · `approved`, `rejected` and `cancelled` are terminal.

| Method | Path | Perm |
|---|---|---|
| GET | `/api/service-types` | session (active only) |
| POST/PATCH | `/api/service-types[/{key}]` | `requests.process` + admin |
| POST | `/api/me/requests` | student. Validate `payload` against `form_schema` (required fields, select options, `subject` must be one of the student's subjects). Max 3 open requests of the same type |
| GET | `/api/me/requests`, `/api/me/requests/{id}` | owner |
| POST | `/api/me/requests/{id}/cancel`, `/respond {note, file_ids}` | owner, only in allowed states |
| GET | `/api/requests?status=&type=&assignee=&q=&page=` | `requests.process` |
| POST | `/api/requests/{id}/transition` | `{to, note, result_file_id?}`, `requests.process`. Writes an event row and calls `notify.Send(kind=request_status)` |
| POST | `/api/requests/{id}/assign` | `{assignee_id}` |

**Seed the 9 UET types** with form schemas:
| key | Fields |
|---|---|
| `change_group` | current group (prefilled, read-only), desired group (select from `class_groups`), reason (textarea) |
| `change_profile` | desired profile (select), reason |
| `reactivation` | semester to resume (select), reason, supporting doc (file) |
| `reassessment` | subject (subject), assessment (select: midterm/final), reason. **requires_payment** |
| `syllabus_request` | subjects (multi-subject), purpose (text), language (sq/en) |
| `payment_nk` | subject (subject). **requires_payment** |
| `payment_reexam` | links to a re-exam registration (7.2). **requires_payment** |
| `certificate` | type (select: Diplomimi / Studenti / Listë Notash), language, copies (1–5) |
| `internship_certificate` | company, period (dates), mentor |

FE:
- [ ] `/services`: hero search (`SearchField` filters cards), catalogue grid (title, description, fee `Badge`, SLA "≈5 days"), and a "My requests" tab.
- [ ] `/services/new/$typeKey`: a **dynamic form renderer** `components/services/DynamicForm.tsx` that maps `form_schema` types → `TextField` / `TextArea` / `Select` / subject `Select` / `FileDrop` / `DatePicker`, validated with `@tanstack/react-form`. Shows a payment notice when `requires_payment`.
- [ ] `/services/requests/$id`: status timeline (ui-sdk `timeline` wrapper) from the events, staff notes, a "Respond" box when `needs_info`, and a result file download (e.g. the certificate PDF).
- [ ] Staff `/services/inbox`: table with status `Chip` filters, assignee filter, SLA overdue highlighting, and a detail drawer with transition buttons (each opens a note dialog).

### Story 7.2: Re-exams (Riprovimet)
Migration `000038_reexams.up.sql`:
```sql
CREATE TABLE reexam_seasons (
  id          TEXT PRIMARY KEY,
  school_year TEXT NOT NULL,
  name        TEXT NOT NULL,                 -- "Sezoni i riprovimeve – Shkurt 2027"
  opens_at    TEXT NOT NULL,
  closes_at   TEXT NOT NULL,
  exam_from   TEXT, exam_to TEXT,
  fee_per_subject INTEGER NOT NULL DEFAULT 0,
  max_subjects    INTEGER NOT NULL DEFAULT 3,
  rules_md    TEXT,
  created_at  TEXT NOT NULL, updated_at TEXT NOT NULL,
  CHECK (opens_at < closes_at)
);
CREATE TABLE reexam_registrations (
  id          TEXT PRIMARY KEY,
  season_id   TEXT NOT NULL REFERENCES reexam_seasons(id) ON DELETE CASCADE,
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  status      TEXT NOT NULL DEFAULT 'pending_payment', -- pending_payment | confirmed | cancelled
  payment_ref TEXT,
  created_at  TEXT NOT NULL, updated_at TEXT NOT NULL,
  UNIQUE (season_id, student_id, subject_id)
);
```
- [ ] **Eligibility** (`internal/reexams.Eligible(studentID)`): subjects where `subject_results` shows a fail (grade below the pass threshold from `grade_scales`), or no result for a past semester. Exclude subjects already passed.
- [ ] `GET /api/reexams/seasons` → all seasons with a computed `state: upcoming|open|closed` and the active count (UET shows "Active seasons: 0").
- [ ] `GET /api/me/reexams?season_id=` → `{eligible:[{subject, last_grade}], registrations:[...]}`.
- [ ] `POST /api/me/reexams` `{season_id, subject_ids}`: season must be open (`season_closed`), subjects eligible (`not_eligible`), count ≤ `max_subjects`. Creates registrations and, if there's a fee, auto-creates a `payment_reexam` service request linked to them.
- [ ] `DELETE /api/me/reexams/{id}`: only while the season is open.
- [ ] Staff: CRUD seasons, `GET /api/reexams/seasons/{id}/registrations` (+ CSV), `POST /api/reexams/registrations/{id}/confirm` (after payment).
- [ ] FE `/reexams`: season cards with a deadline countdown and a state `Badge`; rules shown as markdown in an `Accordion`; eligible subject `Checkbox` list with a fee total; confirm dialog; "My registrations" table. Empty state when no season is open: "No re-exam season is active at the moment" plus a tip to check the academic record first (link to `/record`).
- [ ] Re-exam deadlines feed the calendar union (Sprint 5).

### Story 7.3: Payments and bank info
Migration `000039_settings.up.sql`: `app_settings(key TEXT PRIMARY KEY, value TEXT NOT NULL, updated_at TEXT)` with keys `bank.name`, `bank.swift`, `bank.iban_eur`, `bank.iban_all`, `bank.account_eur`, `bank.account_all`, `bank.beneficiary`, `bank.payment_description_template` (e.g. `"{student_code} {student_name} {purpose}"`).
- [ ] `GET /api/bank-info` (session) and `PUT /api/admin/settings/bank` (`payments.manage`).
- [ ] `GET /api/me/payment-slip.pdf?purpose=tuition|reexam|request&ref=` renders a PDF server-side (Go: `github.com/go-pdf/fpdf`, embed Atkinson Hyperlegible for ë/ç glyphs) with student code, name, programme, amount, reference, and both bank accounts.
- [ ] FE `/payments`: bank details cards with copy-to-clipboard per IBAN, a "Download payment slip" button, and the list of outstanding fees (re-exam registrations and requests in `pending_payment`).
- [ ] Staff: mark a payment received → registration/request moves on (`confirmed` / `in_review`).

### Story 7.4: Academic record from the secretary
UET splits this into "Modules from Secretary" and "Grades from secretary". OptimoLMS already has `/record` and `subject_results`.
- [ ] Extend `GET /api/me/record` with per-semester grouping: `{semesters:[{school_year, semester, modules:[{code,name,status,group,components:[{name,weight,points}], total, grade, synced_at}]}], gpa, credits_earned}`.
- [ ] FE `/record`: semester `Accordion`s (latest open), components table, GPA summary card, and a "Download transcript" button (requests a `certificate` with type Listë Notash, prefilled).

### Sprint 7 tests
Request state machine (all legal and illegal transitions); payload validation against the schema; re-exam eligibility (failed included, passed excluded); season window enforcement; max subjects; the payment slip PDF contains the IBAN (extract the text in the test).

### Sprint 7 demo script
Secretary opens a re-exam season → student sees 1 failed subject as eligible → registers → a payment request is auto-created → student downloads the payment slip → secretary marks it paid → registration confirmed → student files a `certificate` request → secretary approves it and attaches a PDF → student downloads it from the request page.

---

## Sprint 8: Polish and launch readiness (weeks 15–16)

**Sprint goal:** Albanian-first, searchable, auditable, tested end to end, and ready to deploy.

### Story 8.1: Internationalisation (sq default, en, it)
- [ ] Add `i18next`, `react-i18next` and `i18next-browser-languagedetector`. Keep resources in `src/locales/{sq,en,it}/{common,courses,services,…}.json`, loaded lazily per namespace.
- [ ] Migration `000040_user_locale.up.sql`: `ALTER TABLE users ADD COLUMN locale TEXT NOT NULL DEFAULT 'sq';`. Add `PUT /api/me/locale`.
- [ ] Extract every hard-coded string in `src/` (track with an ESLint rule `i18next/no-literal-string` in warn mode, then error).
- [ ] Map backend error **codes** (from §0.2) → `errors.<code>` keys. FE `toast.error(t(\`errors.${code}\`))`.
- [ ] Dates and numbers through `Intl` with the active locale (`src/format.ts`). Albanian month names come from `Intl` (`sq-AL`).
- [ ] Language switcher (Shqip / English / Italiano) in `UserMenu` and on `/login`.
- [ ] `service_types` already holds `name_sq/name_en`. Add `_it` columns, or fall back to English.

### Story 8.2: Global search
- [ ] Migration `000041_search.up.sql`: FTS5 virtual table `search_index(entity_type, entity_id, subject_id, title, body, tokenize='unicode61 remove_diacritics 2')` (so "e" matches "ë"), kept up to date by triggers on subjects, resources, lectures, assignments, forum_posts and service_types.
- [ ] `GET /api/search?q=&type=&page=` filters results to what the principal can access (enrolled subjects, own requests) and returns highlighted snippets (`snippet()`).
- [ ] FE: ⌘K / Ctrl+K command palette using ui-sdk `command` (new wrapper) with grouped results, recent searches and quick actions ("New request", "Open timetable").

### Story 8.3: Audit log
- [ ] Migration `000042_audit_log.up.sql`: `audit_log(id, actor_id, action, entity_type, entity_id, before_json, after_json, ip, created_at)`, indexed on `(entity_type, entity_id)`.
- [ ] Record grade entry changes, submission grading, request transitions, re-exam confirmations, permission and role changes, password and 2FA changes, and session revokes.
- [ ] `GET /api/audit?entity_type=&entity_id=&actor=&from=&to=` (admin). FE `/admin/audit` table plus a "History" `Popover` next to grade cells.

### Story 8.4: Testing and quality gates
- [ ] **Playwright** (`frontend/e2e/`) against a backend booted with a fresh seeded DB (`OPTIMOLMS_DB=:memory:` or a temp file):
  1. `student-core.spec.ts`: login → my courses → open course → mark done → download resource → submit assignment → see grade.
  2. `quiz.spec.ts`: start, answer, reload and resume, submit, review.
  3. `services.spec.ts`: file a request → staff approves → student downloads the result.
  4. `reexam.spec.ts`: open season → register → pay → confirm.
  5. `security.spec.ts`: direct URL to another student's record shows 403; logout clears access.
- [ ] **axe** check inside each Playwright spec (`@axe-core/playwright`), with 0 serious/critical violations.
- [ ] GitHub Actions: `go vet`, `go test -race ./...`, `npm run typecheck`, `npm run build`, Playwright (chromium) and axe.
- [ ] Backend coverage target ≥ 70 % for `internal/session`, `internal/requests`, `internal/reexams` and `internal/srs`.

### Story 8.5: Performance, ops and docs
- [ ] SQLite: `PRAGMA journal_mode=WAL; busy_timeout=5000; foreign_keys=ON` (check `db.go`). Add missing indexes found with `EXPLAIN QUERY PLAN` on `/me/subjects`, `/me/timeline` and `/me/events`.
- [ ] FE: route-level code splitting (`lazy` routes). Mermaid, KaTeX and shiki load only in chat. This also clears the current >500 kB chunk warning.
- [ ] Mobile pass at 375 px for every new route (use the `mobile-native` checklist: 100dvh, input zoom, tap targets ≥ 44 px).
- [ ] Backups: a nightly `sqlite3 .backup` plus a tarball of `FILES_DIR`. Document restore.
- [ ] README: architecture, env vars (`COOKIE_SECURE`, `FILES_DIR`, `SMTP_*`, `APP_ORIGIN`), API table, seed personas.
- [ ] Two student manuals (sq/en) as in-app markdown pages under `/help`. UET links its manual from the Studenti menu.

### Sprint 8 demo script
Switch to Shqip → the whole flow is in Albanian → ⌘K "data com" finds Data Communication and its resources → change a grade → audit history shows before/after → CI is green with the Playwright and axe reports attached.

---

## Appendix A: Migration index
| # | File | Sprint |
|---|---|---|
| 019 | sessions | 1 |
| 020 | permission_keys_v2 | 1 |
| 021 | access_tokens | 1 |
| 022 | student_identity | 2 |
| 023 | files | 3 |
| 024 | submission_files | 3 |
| 025 | resources | 3 |
| 026 | user_quota | 3 |
| 027 | completions | 4 |
| 028 | quiz_settings | 4 |
| 029 | flashcard_reviews | 4 |
| 030 | forum_reads | 4 |
| 031 | timetable | 5 |
| 032 | events | 5 |
| 033 | recent_items | 5 |
| 034 | forum_kinds (rebuilds forums) | 6 |
| 035 | messaging | 6 |
| 036 | notification_prefs | 6 |
| 037 | service_requests | 7 |
| 038 | reexams | 7 |
| 039 | settings | 7 |
| 040 | user_locale | 8 |
| 041 | search (FTS5) | 8 |
| 042 | audit_log | 8 |

## Appendix B: New frontend routes
`/my/courses` · `/files` · `/lectures` · `/quizzes` · `/quizzes/$quizId/attempt` · `/flashcards` · `/flashcards/$subjectId/study` · `/forums` · `/timetable` · `/timetable/manage` · `/calendar` · `/messages` · `/services` · `/services/new/$typeKey` · `/services/requests/$id` · `/services/inbox` · `/reexams` · `/payments` · `/admin/audit` · `/help`

## Appendix C: New shared UI wrappers (ui-sdk behaviour + `styles.css` looks)
`SegmentedControl` (S2) · `FileDrop` (S3) · `Radio`/`RadioGroup` (S4) · `Calendar`, `DatePicker`, `TimeInput` (S5) · `Drawer` (S6) · `Timeline` (S7) · `Command` (S8). Already done: Tabs, Menu, Popover, Tooltip, Checkbox, Switch, Progress, Avatar, Accordion, Select, Field inputs.

## Appendix D: UET → OptimoLMS mapping
| UET page | OptimoLMS |
|---|---|
| `/my` Dashboard | `/` (S5 layout) |
| `/my/courses.php` | `/my/courses` (S2) |
| `/course/view.php` + tabs | `/subjects/$id?tab=` (S2–S3) |
| `/grade/report/overview` | `/grades` (exists) |
| `/calendar/view.php` | `/calendar` (S5) |
| `/message/index.php` | `/messages` (S6) |
| `/user/preferences.php` | `/settings/*` (S1, S6, S8) |
| `/user/files.php` | `/files` (S3) |
| `local/riprovimet` | `/reexams` (S7) |
| `local/sherbimet` | `/services` (S7) |
| `local/student?p=5` | `/payments` (S7) |
| `local/raporteums/*` | `/record` (S7.4), `/timetable` (S5) |
| `local/notatUMS/orari.php`, `local/timetable` | `/timetable` (S5) |
| Site news | Dashboard card (S6) |
| Manuals | `/help` (S8) |
| Out of scope | Competencies, blogs, tags, portfolios, repositories, mobile app / QR login |
