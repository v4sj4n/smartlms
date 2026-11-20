-- 000016: per-user cap on assistant reply length.
-- 0 means "no cap": the provider's own default applies.
ALTER TABLE user_ai_settings ADD COLUMN max_output_tokens INTEGER NOT NULL DEFAULT 0;
