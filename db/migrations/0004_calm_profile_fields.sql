ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;