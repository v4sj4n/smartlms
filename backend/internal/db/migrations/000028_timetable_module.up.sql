-- 000028: the timetable module
--
-- The Timetable screen is the weekly view of everything that has a time slot:
-- lectures with their room and lecturer, ordered Monday to Sunday. The data was
-- always there (lectures.scheduled_at, classes.name, subjects.lecturer_id); what
-- was missing was a module key for the sidebar entry, so no role could reach the
-- screen at all.
--
-- Everybody reads the timetable — a student checks where their next lecture is,
-- a lecturer checks their own week, an administrator plans the rooms — so the
-- module is granted to all three roles. Reading is what the module gates; the
-- route itself (`GET /api/schedule`, no policy in
-- internal/handler/session.go) is open to any signed-in caller, and the writes
-- that fill it are the existing lecture endpoints behind lectures.manage.
--
-- Idempotent: modules.key is UNIQUE and role_modules is keyed by
-- (role_id, module_id), so INSERT OR IGNORE adds what is missing and leaves an
-- existing row (or a hand-made grant) untouched.

INSERT OR IGNORE INTO modules (id, key, name, description) VALUES
  ('module-timetable', 'timetable', 'Timetable',
   'The week at a glance: every lecture with its room, subject and lecturer');

INSERT OR IGNORE INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r
JOIN modules m ON m.key = 'timetable'
WHERE r.name IN ('ADMIN', 'LECTURER', 'STUDENT');
