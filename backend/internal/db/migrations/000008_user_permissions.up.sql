-- 000008: per-user permission overrides
-- Effective access = the user's role grants, plus any extra grants made
-- directly on the user (a deliberate override on top of the role).

CREATE TABLE user_permissions (
  user_id       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  permission_id TEXT NOT NULL REFERENCES permissions(id) ON DELETE CASCADE,
  granted_by    TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at    TEXT NOT NULL,
  PRIMARY KEY (user_id, permission_id)
);
