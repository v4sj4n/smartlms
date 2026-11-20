-- 000010: assignments, gradebook, study record and course forums
--
-- Fills the gaps that exist in the legacy UET LMS but were missing here:
--   * seminars become assignments (they carry a due date, a submission and a
--     grade, which is what students actually see in the old Moodle)
--   * lecturer-defined weighted grade components (B1) with per-student points
--   * subject_results for the study card / transcript (B3, B4), derived from
--     the gradebook with a secretary override
--   * course forums with professor-started topics and student replies (A7)
--   * quiz attempt timing, so time limits apply to quizzes and timed seminars

/* ---------- academic metadata on subjects ---------- */

ALTER TABLE subjects ADD COLUMN ects REAL;
ALTER TABLE subjects ADD COLUMN semester TEXT NOT NULL DEFAULT 'FIRST'; -- FIRST | SECOND
ALTER TABLE subjects ADD COLUMN school_year TEXT;

/* ---------- seminars become assignments ---------- */

ALTER TABLE seminars RENAME TO assignments;

ALTER TABLE assignments ADD COLUMN due_at TEXT;
ALTER TABLE assignments ADD COLUMN max_points INTEGER NOT NULL DEFAULT 100;
ALTER TABLE assignments ADD COLUMN allow_late INTEGER NOT NULL DEFAULT 1;
ALTER TABLE assignments ADD COLUMN submission_type TEXT NOT NULL DEFAULT 'both'; -- text | file | both
ALTER TABLE assignments ADD COLUMN is_published INTEGER NOT NULL DEFAULT 1;

CREATE INDEX IF NOT EXISTS idx_assignments_subject ON assignments(subject_id);

CREATE TABLE IF NOT EXISTS assignment_submissions (
  id            TEXT PRIMARY KEY,
  assignment_id TEXT NOT NULL REFERENCES assignments(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  content       TEXT,
  file_url      TEXT,
  status        TEXT NOT NULL DEFAULT 'submitted', -- submitted | late | graded
  score         REAL,
  feedback      TEXT,
  submitted_at  TEXT NOT NULL,
  graded_at     TEXT,
  graded_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (assignment_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_submissions_student ON assignment_submissions(student_id);

/* ---------- gradebook ---------- */

CREATE TABLE IF NOT EXISTS grade_components (
  id             TEXT PRIMARY KEY,
  subject_id     TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'coursework', -- midterm | final | engagement | coursework | project | other
  weight_percent REAL NOT NULL DEFAULT 0,
  max_points     INTEGER NOT NULL DEFAULT 100,
  order_index    INTEGER NOT NULL DEFAULT 0,
  is_published   INTEGER NOT NULL DEFAULT 1,
  created_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_grade_components_subject ON grade_components(subject_id);

CREATE TABLE IF NOT EXISTS grade_entries (
  id           TEXT PRIMARY KEY,
  component_id TEXT NOT NULL REFERENCES grade_components(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  points       REAL,
  comment      TEXT,
  graded_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  graded_at    TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL,
  UNIQUE (component_id, student_id)
);

CREATE INDEX IF NOT EXISTS idx_grade_entries_student ON grade_entries(student_id);

-- 0-100 points -> 4-10 grade. Editable per school year; the default row is the
-- Albanian scale (91-100 -> 10 ... 0-40 -> 4, pass >= 5).
CREATE TABLE IF NOT EXISTS grade_scales (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  school_year TEXT,
  is_default  INTEGER NOT NULL DEFAULT 0,
  pass_grade  REAL NOT NULL DEFAULT 5,
  bands       TEXT NOT NULL DEFAULT '[]',
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

INSERT INTO grade_scales (id, name, school_year, is_default, pass_grade, bands, created_at, updated_at)
VALUES (
  'scale-albanian-default',
  'Albanian 4-10 (default)',
  NULL,
  1,
  5,
  '[{"min":91,"max":100,"grade":10},{"min":81,"max":90,"grade":9},{"min":71,"max":80,"grade":8},{"min":61,"max":70,"grade":7},{"min":51,"max":60,"grade":6},{"min":41,"max":50,"grade":5},{"min":0,"max":40,"grade":4}]',
  strftime('%Y-%m-%dT%H:%M:%SZ','now'),
  strftime('%Y-%m-%dT%H:%M:%SZ','now')
);

/* ---------- study record ---------- */

CREATE TABLE IF NOT EXISTS subject_results (
  id              TEXT PRIMARY KEY,
  student_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id      TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_year     TEXT,
  semester        TEXT,
  attempt_no      INTEGER NOT NULL DEFAULT 1,
  total_points    REAL,
  grade_value     REAL,
  status          TEXT NOT NULL DEFAULT 'in_progress', -- passed | failed | in_progress | withdrawn
  ects            REAL,
  source          TEXT NOT NULL DEFAULT 'derived',      -- derived | manual
  is_official     INTEGER NOT NULL DEFAULT 0,
  override_points REAL,
  override_grade  REAL,
  override_note   TEXT,
  override_by     TEXT REFERENCES users(id) ON DELETE SET NULL,
  override_at     TEXT,
  computed_at     TEXT,
  created_at      TEXT NOT NULL,
  updated_at      TEXT NOT NULL,
  UNIQUE (student_id, subject_id, attempt_no)
);

CREATE INDEX IF NOT EXISTS idx_subject_results_student ON subject_results(student_id);
CREATE INDEX IF NOT EXISTS idx_subject_results_subject ON subject_results(subject_id);

/* ---------- course forums ---------- */

CREATE TABLE IF NOT EXISTS forums (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  description TEXT,
  is_locked   INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forums_subject ON forums(subject_id);

CREATE TABLE IF NOT EXISTS forum_threads (
  id           TEXT PRIMARY KEY,
  forum_id     TEXT NOT NULL REFERENCES forums(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  body         TEXT NOT NULL,
  author_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  is_pinned    INTEGER NOT NULL DEFAULT 0,
  is_locked    INTEGER NOT NULL DEFAULT 0,
  last_post_at TEXT NOT NULL,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forum_threads_forum ON forum_threads(forum_id);

CREATE TABLE IF NOT EXISTS forum_posts (
  id         TEXT PRIMARY KEY,
  thread_id  TEXT NOT NULL REFERENCES forum_threads(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_forum_posts_thread ON forum_posts(thread_id);

/* ---------- quiz/seminar attempt timing ---------- */

CREATE TABLE quiz_attempts_new (
  id           TEXT PRIMARY KEY,
  quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0,
  started_at   TEXT NOT NULL,
  expires_at   TEXT,
  status       TEXT NOT NULL DEFAULT 'completed', -- in_progress | completed | expired
  completed_at TEXT
);

INSERT INTO quiz_attempts_new (id, quiz_id, student_id, score, started_at, expires_at, status, completed_at)
SELECT id, quiz_id, student_id, score, completed_at, NULL, 'completed', completed_at
FROM quiz_attempts;

DROP TABLE quiz_attempts;
ALTER TABLE quiz_attempts_new RENAME TO quiz_attempts;

CREATE INDEX IF NOT EXISTS idx_quiz_attempts_student ON quiz_attempts(student_id, quiz_id);

/* ---------- module rename: seminars -> assignments ---------- */

UPDATE modules SET key = 'assignments', name = 'Assignments',
  description = 'Assignments, due dates and submissions'
WHERE key = 'seminars';

UPDATE permissions SET key = 'assignments.view', label = 'View assignments',
  description = 'See assignments, due dates and own submissions'
WHERE key = 'seminars.view';

UPDATE permissions SET key = 'assignments.manage', label = 'Manage assignments',
  description = 'Create, schedule, edit and remove assignments'
WHERE key = 'seminars.manage';
