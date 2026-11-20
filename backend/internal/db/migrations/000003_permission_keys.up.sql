-- 000003: per-module named permissions
-- replaces the generic CRUD actions with module-owned permission keys such as
-- campuses.view / campuses.manage, and adds explicit per-role grants.

DROP TABLE IF EXISTS permissions;

CREATE TABLE permissions (
  id          TEXT PRIMARY KEY,
  module_id   TEXT NOT NULL REFERENCES modules(id) ON DELETE CASCADE,
  key         TEXT NOT NULL, -- e.g. campuses.view, campuses.manage
  label       TEXT NOT NULL,
  description TEXT,
  UNIQUE (module_id, key)
);

CREATE TABLE role_permissions (
  role_id       TEXT NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  PRIMARY KEY (role_id, permission_id)
);
