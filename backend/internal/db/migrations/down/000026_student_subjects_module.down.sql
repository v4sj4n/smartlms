-- Reverse of 000026_student_subjects_module.up.sql.
--
-- Removes exactly what the up file adds, and only for the STUDENT role: the
-- subjects module grant and the subjects.view grant.
--
-- Not embedded on purpose: the migration runner reads migrations/*.sql (no
-- subdirectories) and treats every file it finds as a forward step keyed by the
-- leading number, so a sibling 000026_*.down.sql would apply before the up file
-- and mark version 000026 as done. Applying this by hand undoes the migration:
--
--   sqlite3 backend/optimolms.db < backend/internal/db/migrations/down/000026_student_subjects_module.down.sql

DELETE FROM role_modules
WHERE role_id = (SELECT id FROM roles WHERE name = 'STUDENT')
  AND module_id = (SELECT id FROM modules WHERE key = 'subjects');

DELETE FROM role_permissions
WHERE role_id = (SELECT id FROM roles WHERE name = 'STUDENT')
  AND permission_id = (
    SELECT p.id
    FROM permissions p
    JOIN modules m ON m.id = p.module_id
    WHERE m.key = 'subjects' AND p.key = 'subjects.view'
  );
