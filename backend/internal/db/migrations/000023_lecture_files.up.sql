-- 000023: a lecture can carry one file
--
-- Lecturers attach the lecture's material: a PDF, an HTML page or a ZIP
-- bundle. The bytes live in the database next to the lecture so a deploy stays
-- a single file, and deleting the lecture (or its subject) removes the file.

CREATE TABLE IF NOT EXISTS lecture_files (
  lecture_id   TEXT PRIMARY KEY REFERENCES lectures(id) ON DELETE CASCADE,
  file_name    TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size         INTEGER NOT NULL,
  data         BLOB NOT NULL,
  uploaded_at  TEXT NOT NULL
);
