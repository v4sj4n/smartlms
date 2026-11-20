-- 000007: AI assistant settings and providers
-- Per-user assistant preferences (general + personalization tabs) and the
-- registry of OpenAI-compatible providers. API keys are stored encrypted
-- (AES-256-GCM); only an opaque hint ever leaves the backend.

CREATE TABLE user_ai_settings (
  user_id        TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  assistant_name TEXT NOT NULL DEFAULT 'AI Assistant',
  system_prompt  TEXT NOT NULL DEFAULT '',
  display_name   TEXT NOT NULL DEFAULT '',
  occupation     TEXT NOT NULL DEFAULT '',
  traits         TEXT NOT NULL DEFAULT '[]',
  notes          TEXT NOT NULL DEFAULT '',
  updated_at     TEXT NOT NULL
);

CREATE TABLE ai_providers (
  id             TEXT PRIMARY KEY,
  scope          TEXT NOT NULL CHECK (scope IN ('institutional', 'personal')),
  owner_user_id  TEXT REFERENCES users(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  base_url       TEXT NOT NULL,
  api_key_cipher TEXT,
  key_hint       TEXT NOT NULL DEFAULT '',
  is_enabled     INTEGER NOT NULL DEFAULT 0,
  default_model  TEXT NOT NULL DEFAULT '',
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL
);

CREATE TABLE ai_models (
  id          TEXT PRIMARY KEY,
  provider_id TEXT NOT NULL REFERENCES ai_providers(id) ON DELETE CASCADE,
  model_id    TEXT NOT NULL,
  is_enabled  INTEGER NOT NULL DEFAULT 0,
  is_default  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (provider_id, model_id)
);
