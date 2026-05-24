ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;--> statement-breakpoint

ALTER TABLE "club_members" ADD COLUMN IF NOT EXISTS "last_read_message_id" uuid;--> statement-breakpoint
ALTER TABLE "club_members" ADD COLUMN IF NOT EXISTS "muted_until" timestamp;--> statement-breakpoint

ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "mentioned_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN IF NOT EXISTS "deleted_at" timestamp;
