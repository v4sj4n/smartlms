-- Reverse of 000027_submission_files.up.sql.
--
-- Removes exactly what the up file adds: the stored submission files and the
-- general settings table (with the two submission limits seeded into it).
--
-- Not embedded on purpose: the migration runner reads migrations/*.sql (no
-- subdirectories) and treats every file it finds as a forward step keyed by the
-- leading number, so a sibling 000027_*.down.sql would apply before the up file
-- and mark version 000027 as done. Applying this by hand undoes the migration:
--
--   sqlite3 backend/optimolms.db < backend/internal/db/migrations/down/000027_submission_files.down.sql
--
-- The submission rows themselves are left alone: dropping the file table only
-- forgets the bytes, not that a student handed something in.

DROP TABLE IF EXISTS submission_files;
DROP TABLE IF EXISTS general_settings;
