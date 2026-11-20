-- 000027: an assignment submission can carry a real file, and the app keeps its
-- general settings in one key/value table.
--
-- A student hands in a worksheet, a slide deck or a zip of code. The bytes live
-- next to the submission in the database (the pattern of 000023_lecture_files),
-- so a deploy stays one file and dropping the submission drops its file. The
-- summary columns (name, kind, size) are what every submission payload shows;
-- the BLOB is never serialized.
--
-- assignment_submissions.file_url stays untouched: it is the share-link option
-- for students who keep their work in Drive or OneDrive.
--
-- general_settings is deliberately a key/value table: a new preference is a row,
-- not a migration. Values are TEXT and JSON-encoded where they are structured.
--
-- The reverse of this migration lives in migrations/down/000027_submission_files.down.sql.
-- It is not embedded (the embed pattern is migrations/*.sql) because the runner
-- treats every migrations/*.sql file as a forward step keyed by its number: a
-- sibling *.down.sql would sort before the *.up.sql, apply first, and mark the
-- version as already applied.

CREATE TABLE IF NOT EXISTS submission_files (
  submission_id TEXT PRIMARY KEY REFERENCES assignment_submissions(id) ON DELETE CASCADE,
  file_name     TEXT NOT NULL, -- the uploaded name, sanitized, as the student sees it
  file_kind     TEXT NOT NULL, -- short badge kind: pdf | docx | pptx | xlsx | zip | png | jpg | txt | md
  content_type  TEXT NOT NULL, -- what the download serves the bytes as
  file_size     INTEGER NOT NULL,
  data          BLOB NOT NULL,
  uploaded_at   TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS general_settings (
  key        TEXT PRIMARY KEY,
  value      TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

-- Seed the two limits the student upload UI reads on first paint.
INSERT INTO general_settings (key, value, updated_at) VALUES
  ('submission_allowed_file_types', '["pdf","docx","pptx","xlsx","zip","png","jpg","jpeg","txt","md"]', strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  ('submission_max_file_mb', '25', strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
ON CONFLICT (key) DO NOTHING;
