DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'generation_origin') THEN
    CREATE TYPE "public"."generation_origin" AS ENUM('MANUAL', 'AI');
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'content_status') THEN
    CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');
  END IF;
END $$;--> statement-breakpoint

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'difficulty') THEN
    CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');
  END IF;
END $$;--> statement-breakpoint

ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "source_file_id" uuid;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "origin" "generation_origin" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "status" "content_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN IF NOT EXISTS "difficulty" "difficulty" DEFAULT 'medium' NOT NULL;--> statement-breakpoint

ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "source_file_id" uuid;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "origin" "generation_origin" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "status" "content_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "difficulty" "difficulty" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "source_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN IF NOT EXISTS "fingerprint" varchar(64);--> statement-breakpoint

ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "nickname" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "bio" text;
