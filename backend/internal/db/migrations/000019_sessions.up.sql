-- 000019: real sign-in sessions
-- A session is one opaque random token, stored only as a SHA-256 hash, with an
-- absolute expiry. The browser carries it in an HttpOnly cookie; anything that
-- is not a browser (MCP clients, curl, tests) sends the same token as
-- `Authorization: Bearer <token>`. Deleting the row signs that one device out.

CREATE TABLE sessions (
  id           TEXT PRIMARY KEY,
  user_id      TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash   TEXT NOT NULL UNIQUE,
  created_at   TEXT NOT NULL,
  expires_at   TEXT NOT NULL,
  last_seen_at TEXT,
  user_agent   TEXT
);

CREATE INDEX sessions_user_id ON sessions(user_id);
CREATE INDEX sessions_expires_at ON sessions(expires_at);
