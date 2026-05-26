CREATE TYPE "user_ai_tone" AS ENUM (
  'Default',
  'Professional',
  'Friendly',
  'Candid',
  'Quirky',
  'Efficient',
  'Cynical'
);
--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_tone" "user_ai_tone" NOT NULL DEFAULT 'Default';--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "ai_custom_instructions" text;--> statement-breakpoint