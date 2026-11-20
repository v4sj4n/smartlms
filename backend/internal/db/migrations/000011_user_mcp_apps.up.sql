-- 000011: MCP apps and the connections each person holds.
--
-- mcp_apps is the shared catalog: one row per MCP server OptimoLMS knows how to
-- talk to, with the avatar mark and tint the profile draws, and the scopes the
-- app asks for. user_mcp_apps records which apps a person has connected, so a
-- profile can list them as avatars and revoking one is a single row delete.

CREATE TABLE mcp_apps (
  key         TEXT PRIMARY KEY,                -- stable slug, e.g. 'github'
  name        TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT 'General',
  glyph       TEXT NOT NULL,                   -- 1-2 characters drawn in the avatar
  tone        TEXT NOT NULL DEFAULT 'gray'     -- avatar tint, maps to a HIG system colour
              CHECK (tone IN ('blue', 'green', 'indigo', 'orange', 'red', 'teal', 'gray')),
  scopes      TEXT NOT NULL DEFAULT '[]',      -- JSON array of scopes granted on connect
  created_at  TEXT NOT NULL
);

CREATE TABLE user_mcp_apps (
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  app_key      TEXT NOT NULL REFERENCES mcp_apps(key) ON DELETE CASCADE,
  connected_at TEXT NOT NULL,
  last_used_at TEXT,                           -- NULL until the assistant calls the app
  PRIMARY KEY (user_id, app_key)
);

CREATE INDEX user_mcp_apps_user_idx ON user_mcp_apps (user_id, connected_at DESC);
