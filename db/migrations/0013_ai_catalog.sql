-- AI provider and model catalog

ALTER TYPE "ai_provider" ADD VALUE IF NOT EXISTS 'ollama';
ALTER TYPE "ai_provider" ADD VALUE IF NOT EXISTS 'lm-studio';

CREATE TYPE "ai_model_type" AS ENUM ('text', 'embedding');

CREATE TABLE IF NOT EXISTS "ai_providers" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL
);

CREATE TABLE IF NOT EXISTS "ai_models" (
  "id" text PRIMARY KEY DEFAULT gen_random_uuid()::text,
  "provider_id" text NOT NULL REFERENCES "ai_providers"("id") ON DELETE CASCADE,
  "model_name" text NOT NULL,
  "model_identifier" text NOT NULL,
  "model_type" "ai_model_type" NOT NULL,
  "enabled" boolean NOT NULL DEFAULT true,
  "created_at" timestamp NOT NULL DEFAULT now(),
  CONSTRAINT "unq_ai_models_provider_identifier" UNIQUE ("provider_id", "model_identifier")
);

CREATE INDEX IF NOT EXISTS "idx_ai_models_provider" ON "ai_models" ("provider_id");
CREATE INDEX IF NOT EXISTS "idx_ai_models_type" ON "ai_models" ("model_type");
