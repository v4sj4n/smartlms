-- 000014: academic structure
-- The university is modelled the way the institution is run:
--
--   faculty (Fakulteti) -> department (Departamenti) -> programme (Dega)
--
-- A programme is what a student is admitted to, and it owns the subjects that
-- belong to its curriculum. Course enrolment (who sits in which subject) stays
-- in `enrollments`; this migration adds the admission side, so a programme can
-- be asked for its students and its courses.

CREATE TABLE faculties (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE,
  code       TEXT UNIQUE,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE departments (
  id         TEXT PRIMARY KEY,
  faculty_id TEXT NOT NULL REFERENCES faculties(id) ON DELETE CASCADE,
  name       TEXT NOT NULL,
  code       TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  UNIQUE (faculty_id, name)
);

CREATE INDEX departments_faculty_idx ON departments (faculty_id);

CREATE TABLE programmes (
  id             TEXT PRIMARY KEY,
  department_id  TEXT NOT NULL REFERENCES departments(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  code           TEXT UNIQUE,
  level          TEXT NOT NULL DEFAULT 'BACHELOR', -- BACHELOR | MASTER | DOCTORATE
  duration_years INTEGER NOT NULL DEFAULT 3,
  total_ects     INTEGER,
  description    TEXT,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  UNIQUE (department_id, name),
  CHECK (level IN ('BACHELOR', 'MASTER', 'DOCTORATE')),
  CHECK (duration_years BETWEEN 1 AND 8),
  CHECK (total_ects IS NULL OR total_ects > 0)
);

CREATE INDEX programmes_department_idx ON programmes (department_id);

/* ---------- students are admitted to a programme ---------- */

CREATE TABLE programme_enrollments (
  id            TEXT PRIMARY KEY,
  programme_id  TEXT NOT NULL REFERENCES programmes(id) ON DELETE CASCADE,
  student_id    TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  school_year   TEXT, -- year of admission, e.g. 2026/2027
  year_of_study INTEGER NOT NULL DEFAULT 1, -- 1st year, 2nd year, ...
  status        TEXT NOT NULL DEFAULT 'ACTIVE', -- ACTIVE | GRADUATED | WITHDRAWN | SUSPENDED
  enrolled_at   TEXT NOT NULL,
  updated_at    TEXT NOT NULL,
  UNIQUE (student_id, programme_id),
  CHECK (status IN ('ACTIVE', 'GRADUATED', 'WITHDRAWN', 'SUSPENDED')),
  CHECK (year_of_study BETWEEN 1 AND 8)
);

-- A student follows one programme at a time. The partial index keeps a single
-- ACTIVE row per student while leaving graduated and withdrawn terms on record
-- (a master's after a bachelor's, or a switch between programmes).
CREATE UNIQUE INDEX programme_enrollments_one_active
  ON programme_enrollments (student_id) WHERE status = 'ACTIVE';

CREATE INDEX programme_enrollments_programme_idx ON programme_enrollments (programme_id);
CREATE INDEX programme_enrollments_student_idx ON programme_enrollments (student_id);

/* ---------- a subject is offered by a programme ---------- */

-- ON DELETE SET NULL: removing a programme never deletes the courses it
-- taught, they simply become unassigned and can be adopted elsewhere.
ALTER TABLE subjects ADD COLUMN programme_id TEXT REFERENCES programmes(id) ON DELETE SET NULL;

-- Which year of the programme the course is taught in.
ALTER TABLE subjects ADD COLUMN year_of_study INTEGER;

CREATE INDEX subjects_programme_idx ON subjects (programme_id);
