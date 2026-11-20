-- 000013: school years
-- The academic year becomes a first-class record. Until now subjects carried a
-- free-text school_year, which drifted ("2026-2027", "2026/2027", typos) and
-- could not be listed, renamed or marked current. Now the catalog owns the
-- names, at most one row is active, and subjects reference a row by name.

CREATE TABLE school_years (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL UNIQUE, -- canonical form: 2026/2027
  starts_on  TEXT,                 -- ISO date (YYYY-MM-DD), optional
  ends_on    TEXT,                 -- ISO date (YYYY-MM-DD), optional
  is_active  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  CHECK (is_active IN (0, 1))
);

-- At most one active year. The index is partial so archived rows can all hold 0.
CREATE UNIQUE INDEX school_years_one_active ON school_years (is_active) WHERE is_active = 1;

-- Adopt the years already written on subjects, normalised to the slash form,
-- so nothing that exists today becomes orphaned by the change.
UPDATE subjects SET school_year = replace(trim(school_year), '-', '/')
WHERE school_year IS NOT NULL AND trim(school_year) <> '';

INSERT OR IGNORE INTO school_years (id, name, is_active, created_at, updated_at)
SELECT lower(hex(randomblob(16))), name, 0, strftime('%Y-%m-%dT%H:%M:%SZ', 'now'), strftime('%Y-%m-%dT%H:%M:%SZ', 'now')
FROM (SELECT DISTINCT school_year AS name FROM subjects WHERE school_year IS NOT NULL AND school_year <> '');

-- The newest year on record is the current one; the screen lets an admin change it.
UPDATE school_years SET is_active = 1
WHERE id = (SELECT id FROM school_years ORDER BY name DESC LIMIT 1);

-- Grade scales were keyed by the same free-text year.
UPDATE grade_scales SET school_year = replace(trim(school_year), '-', '/')
WHERE school_year IS NOT NULL AND trim(school_year) <> '';

-- Filters and per-year counts read subjects by year.
CREATE INDEX subjects_school_year_idx ON subjects (school_year);

/* ---------- the academic calendar is its own module ---------- */

INSERT OR IGNORE INTO modules (id, key, name, description) VALUES
  ('module-school-years', 'school-years', 'School years',
   'The academic years the school runs and which one is current');

INSERT OR IGNORE INTO permissions (id, module_id, key, label, description)
SELECT 'permission-school-years-view', id, 'school-years.view', 'View school years',
       'See school years, their dates and which one is active'
FROM modules WHERE key = 'school-years';

INSERT OR IGNORE INTO permissions (id, module_id, key, label, description)
SELECT 'permission-school-years-manage', id, 'school-years.manage', 'Manage school years',
       'Create, edit, activate and remove school years'
FROM modules WHERE key = 'school-years';

-- Administrators run the academic calendar; other roles read the year names
-- off the subjects they are enrolled in.
INSERT OR IGNORE INTO role_modules (role_id, module_id)
SELECT r.id, m.id FROM roles r, modules m
WHERE r.name = 'ADMIN' AND m.key = 'school-years';

INSERT OR IGNORE INTO role_permissions (role_id, permission_id)
SELECT r.id, p.id FROM roles r, permissions p
WHERE r.name = 'ADMIN' AND p.key IN ('school-years.view', 'school-years.manage');
