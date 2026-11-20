-- 000020: remember what the last key/endpoint check found
-- Connecting or rotating a key verifies it against the provider's model list,
-- so the outcome is stored beside the key: the Providers tab can then show
-- "Ready · 3 models" or "Invalid key" without calling the provider again.

ALTER TABLE ai_providers ADD COLUMN health        TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_providers ADD COLUMN health_detail TEXT NOT NULL DEFAULT '';
ALTER TABLE ai_providers ADD COLUMN checked_at    TEXT NOT NULL DEFAULT '';
