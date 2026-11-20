-- 000009: per-user appearance preferences (theme + reading font).
-- No row means defaults: follow the OS theme, system font.

CREATE TABLE user_appearance (
  user_id    TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  theme      TEXT NOT NULL DEFAULT 'system' CHECK (theme IN ('system', 'light', 'dark')),
  font       TEXT NOT NULL DEFAULT 'system' CHECK (font IN ('system', 'legible', 'dyslexic')),
  updated_at TEXT NOT NULL
);
