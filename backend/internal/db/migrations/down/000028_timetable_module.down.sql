-- Reverse of 000028_timetable_module.up.sql.
--
-- Removes exactly what the up file adds: the timetable module grants for
-- ADMIN, LECTURER and STUDENT, and the module row itself. Any role_modules row
-- still pointing at the module is deleted with it (the foreign key cascades, and
-- the grants are removed explicitly first so the intent is readable).
--
-- Not embedded on purpose: the migration runner reads migrations/*.sql (no
-- subdirectories) and treats every file it finds as a forward step keyed by the
-- leading number, so a sibling 000028_*.down.sql would apply before the up file
-- and mark version 000028 as done. Applying this by hand undoes the migration:
--
--   sqlite3 backend/optimolms.db < backend/internal/db/migrations/down/000028_timetable_module.down.sql

DELETE FROM role_modules
WHERE module_id = (SELECT id FROM modules WHERE key = 'timetable')
  AND role_id IN (SELECT id FROM roles WHERE name IN ('ADMIN', 'LECTURER', 'STUDENT'));

DELETE FROM modules WHERE key = 'timetable';
