-- Add provider status and local flags

DO $$
BEGIN
  CREATE TYPE "ai_provider_status" AS ENUM ('enabled', 'disabled');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "ai_providers"
  ADD COLUMN IF NOT EXISTS "status" "ai_provider_status" NOT NULL DEFAULT 'enabled',
  ADD COLUMN IF NOT EXISTS "local" boolean NOT NULL DEFAULT false;

UPDATE "ai_providers"
SET
  "status" = 'enabled',
  "local" = CASE
    WHEN "id" IN ('local', 'ollama', 'lm-studio') THEN true
    ELSE false
  END;