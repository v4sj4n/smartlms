DO $$ BEGIN
  CREATE TYPE "public"."session_type" AS ENUM('lecture', 'seminar');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE "public"."notification_type" AS ENUM('grade', 'assignment_due', 'announcement', 'general');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "source_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;
ALTER TABLE "questions" ADD COLUMN IF NOT EXISTS "source_file_id" uuid;

ALTER TABLE "quiz_attempts" ADD COLUMN IF NOT EXISTS "review_suggestions" jsonb DEFAULT '[]'::jsonb;

ALTER TABLE "subject_assignments" ADD COLUMN IF NOT EXISTS "session_type" "session_type" DEFAULT 'lecture' NOT NULL;

ALTER TABLE "course_schedules" ADD COLUMN IF NOT EXISTS "session_type" "session_type" DEFAULT 'lecture';

CREATE TABLE IF NOT EXISTS "notifications" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL,
  "type" "notification_type" DEFAULT 'general' NOT NULL,
  "title" text NOT NULL,
  "body" text NOT NULL,
  "href" text,
  "read_at" timestamp,
  "created_at" timestamp DEFAULT now() NOT NULL
);

DO $$ BEGIN
  ALTER TABLE "notifications" ADD CONSTRAINT "notifications_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS "idx_notifications_user" ON "notifications" USING btree ("user_id");
CREATE INDEX IF NOT EXISTS "idx_notifications_user_unread" ON "notifications" USING btree ("user_id", "read_at");

DO $$ BEGIN
  ALTER TABLE "questions" ADD CONSTRAINT "questions_source_file_id_files_id_fk"
    FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
