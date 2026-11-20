-- 000026: let STUDENT reach the Subjects screen
--
-- Students already hold the subjects.view permission (they have always needed it
-- to read a subject's metadata, weeks and grades), but their role never got the
-- subjects *module*, so the sidebar entry was missing and /subjects answered
-- "No access to Subjects". The module only opens the list screen: every write on
-- it is gated behind subjects.manage, which STUDENT does not have, so the page
-- stays read-only.
--
-- Idempotent: role_modules is keyed by (role_id, module_id) and role_permissions
-- by (role_id, permission_id), so INSERT OR IGNORE both adds the missing row and
-- leaves an existing one (or an administrator's grant) untouched.

INSERT OR IGNORE INTO role_modules (role_id, module_id)
SELECT r.id, m.id
FROM roles r
JOIN modules m ON m.key = 'subjects'
WHERE r.name = 'STUDENT';

-- Reading a subject needs subjects.view on the route policy in
-- internal/handler/session.go. It is seeded for STUDENT, so this is a no-op on
-- databases seeded by this build; it repairs any database where the grant was
-- removed by hand.
INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id
FROM roles r
JOIN modules m ON m.key = 'subjects'
JOIN permissions p ON p.module_id = m.id AND p.key = 'subjects.view'
WHERE r.name = 'STUDENT';
