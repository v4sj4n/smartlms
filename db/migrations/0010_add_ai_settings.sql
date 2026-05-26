-- AI Configuration Settings Migration
-- Adds support for configurable AI providers and models

-- Create AI provider enum
CREATE TYPE "ai_provider" AS ENUM (
    'openai',
    'anthropic',
    'google',
    'mistral',
    'groq',
    'xai',
    'cohere',
    'deepseek',
    'fireworks',
    'togetherai',
    'perplexity',
    'local'
);

-- Create AI settings table
CREATE TABLE "ai_settings" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    -- Chat Model Configuration
    "chat_provider" "ai_provider" NOT NULL DEFAULT 'google',
    "chat_model_id" varchar(128) NOT NULL DEFAULT 'gemini-2.0-flash-001',
    "chat_api_key" text,
    "chat_base_url" text,
    "chat_temperature" varchar(10) DEFAULT '0.7',
    "chat_max_tokens" integer DEFAULT 4096,
    -- Embedding Model Configuration
    "embedding_provider" "ai_provider" NOT NULL DEFAULT 'google',
    "embedding_model_id" varchar(128) NOT NULL DEFAULT 'gemini-embedding-001',
    "embedding_api_key" text,
    "embedding_base_url" text,
    "embedding_dimensions" integer DEFAULT 1024,
    -- Feature Flags
    "is_enabled" boolean NOT NULL DEFAULT true,
    "allow_file_uploads" boolean NOT NULL DEFAULT true,
    -- Audit
    "updated_at" timestamp NOT NULL DEFAULT now(),
    "updated_by" uuid REFERENCES "users"("id") ON DELETE SET NULL
);

-- Create index for quick lookup (only one row should exist)
CREATE UNIQUE INDEX "idx_ai_settings_single" ON "ai_settings" ((true));

-- Insert default settings
INSERT INTO "ai_settings" ("id") VALUES (gen_random_uuid());
