-- 000006: content lives inside subjects
-- removes the intermediate course layer added in 000004: lectures, seminars,
-- quizzes and flashcards reference the subject directly again, and students
-- enroll per subject.

DROP TABLE IF EXISTS quiz_attempts;
DROP TABLE IF EXISTS quiz_questions;
DROP TABLE IF EXISTS quizzes;
DROP TABLE IF EXISTS flashcards;
DROP TABLE IF EXISTS lectures;
DROP TABLE IF EXISTS seminars;
DROP TABLE IF EXISTS enrollments;
DROP TABLE IF EXISTS courses;

CREATE TABLE lectures (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL, -- room
  title        TEXT NOT NULL,
  description  TEXT,
  scheduled_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE seminars (
  id           TEXT PRIMARY KEY,
  subject_id   TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  class_id     TEXT REFERENCES classes(id) ON DELETE SET NULL, -- room
  title        TEXT NOT NULL,
  description  TEXT,
  scheduled_at TEXT,
  created_at   TEXT NOT NULL,
  updated_at   TEXT NOT NULL
);

CREATE TABLE quizzes (
  id                 TEXT PRIMARY KEY,
  subject_id         TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  description        TEXT,
  time_limit_minutes INTEGER,
  created_at         TEXT NOT NULL,
  updated_at         TEXT NOT NULL
);

CREATE TABLE quiz_questions (
  id          TEXT PRIMARY KEY,
  quiz_id     TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  type        TEXT NOT NULL, -- mcq | true_false | short_answer
  prompt      TEXT NOT NULL,
  options     TEXT NOT NULL DEFAULT '[]', -- JSON array of strings
  answer      TEXT NOT NULL,              -- JSON value
  points      INTEGER NOT NULL DEFAULT 1,
  order_index INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE flashcards (
  id         TEXT PRIMARY KEY,
  subject_id TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  front      TEXT NOT NULL,
  back       TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE enrollments (
  id          TEXT PRIMARY KEY,
  student_id  TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  enrolled_at TEXT NOT NULL,
  UNIQUE (student_id, subject_id)
);

CREATE TABLE quiz_attempts (
  id           TEXT PRIMARY KEY,
  quiz_id      TEXT NOT NULL REFERENCES quizzes(id) ON DELETE CASCADE,
  student_id   TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  score        INTEGER NOT NULL DEFAULT 0,
  completed_at TEXT NOT NULL
);
