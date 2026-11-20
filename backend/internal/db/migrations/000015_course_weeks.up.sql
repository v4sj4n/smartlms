-- 000015: course weeks
-- A school year runs in two halves (seasons): fall and summer. A subject is
-- taught week by week inside one of them, the way a student reads a course:
-- week 1, week 2, ... each with the content of that week.
--
-- Weeks hang off a subject, carry their own date range, and the content that
-- belongs to a week points at it. ON DELETE SET NULL: removing a week never
-- deletes what was taught in it, the content simply becomes unscheduled.

CREATE TABLE course_weeks (
  id          TEXT PRIMARY KEY,
  subject_id  TEXT NOT NULL REFERENCES subjects(id) ON DELETE CASCADE,
  school_year TEXT,                            -- 2026/2027, NULL = unassigned
  season      TEXT NOT NULL DEFAULT 'FALL',    -- FALL | SUMMER
  week_number INTEGER NOT NULL,                -- 1.. within the season
  title       TEXT,
  description TEXT,
  starts_on   TEXT,                            -- Monday of the week, YYYY-MM-DD
  ends_on     TEXT,                            -- Sunday of the week, YYYY-MM-DD
  created_at  TEXT NOT NULL,
  updated_at  TEXT NOT NULL,
  CHECK (season IN ('FALL', 'SUMMER')),
  CHECK (week_number BETWEEN 1 AND 30)
);

CREATE INDEX course_weeks_subject_idx ON course_weeks (subject_id);

-- One week per number inside a subject/season. COALESCE folds an unassigned
-- school year to '', so the constraint holds when the year is NULL.
CREATE UNIQUE INDEX course_weeks_unique_week
  ON course_weeks (subject_id, COALESCE(school_year, ''), season, week_number);

ALTER TABLE lectures    ADD COLUMN week_id TEXT REFERENCES course_weeks(id) ON DELETE SET NULL;
ALTER TABLE assignments ADD COLUMN week_id TEXT REFERENCES course_weeks(id) ON DELETE SET NULL;
ALTER TABLE quizzes     ADD COLUMN week_id TEXT REFERENCES course_weeks(id) ON DELETE SET NULL;
ALTER TABLE flashcards  ADD COLUMN week_id TEXT REFERENCES course_weeks(id) ON DELETE SET NULL;

CREATE INDEX lectures_week_idx    ON lectures (week_id);
CREATE INDEX assignments_week_idx ON assignments (week_id);
CREATE INDEX quizzes_week_idx     ON quizzes (week_id);
CREATE INDEX flashcards_week_idx  ON flashcards (week_id);
