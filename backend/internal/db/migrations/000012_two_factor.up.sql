-- 000012: per-user two-factor authentication (TOTP, RFC 6238)
--
-- Every account can turn 2FA on for itself. The shared secret is stored
-- encrypted (AES-256-GCM, see internal/keycrypt) so a copy of the database file
-- alone cannot mint codes. totp_enabled_at stays NULL while a secret is only
-- pending confirmation and after 2FA is turned off, which is the single flag
-- the login flow branches on.

ALTER TABLE users ADD COLUMN totp_secret TEXT;      -- encrypted base32 secret, NULL = none
ALTER TABLE users ADD COLUMN totp_enabled_at TEXT;  -- RFC3339, NULL = 2FA off
-- totp_last_counter remembers the last time step that signed in, so a code
-- observed over someone's shoulder cannot be replayed inside its own window.
ALTER TABLE users ADD COLUMN totp_last_counter INTEGER NOT NULL DEFAULT 0;

-- Recovery codes are the way back in when the phone is gone. Only a hash is
-- stored; the prefix is kept in the clear so one row can be found and hashed
-- against, instead of hashing every code on every attempt.
CREATE TABLE user_recovery_codes (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  code_prefix TEXT NOT NULL,
  code_hash   TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  used_at     TEXT
);

CREATE INDEX idx_user_recovery_codes_user ON user_recovery_codes (user_id);
CREATE INDEX idx_user_recovery_codes_prefix ON user_recovery_codes (user_id, code_prefix);

-- A challenge is the ticket handed out between the password step and the code
-- step. It only works once, expires in minutes, and burns itself after a few
-- wrong codes.
CREATE TABLE two_factor_challenges (
  id          TEXT PRIMARY KEY,
  user_id     TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash  TEXT NOT NULL UNIQUE,
  attempts    INTEGER NOT NULL DEFAULT 0,
  expires_at  TEXT NOT NULL,
  created_at  TEXT NOT NULL,
  consumed_at TEXT
);

CREATE INDEX idx_two_factor_challenges_user ON two_factor_challenges (user_id);
