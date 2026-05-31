DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_type') THEN
    CREATE TYPE "public"."assignment_type" AS ENUM('essay', 'project', 'homework', 'lab_report', 'presentation');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_origin') THEN
    CREATE TYPE "public"."assignment_origin" AS ENUM('manual', 'ai_generated');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'assignment_submission_type') THEN
    CREATE TYPE "public"."assignment_submission_type" AS ENUM('text', 'file', 'both');
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "assignment_type" NOT NULL DEFAULT 'homework',
	"origin" "assignment_origin" NOT NULL DEFAULT 'manual',
	"source_file_id" uuid,
	"submission_type" "assignment_submission_type" NOT NULL DEFAULT 'both',
	"max_score" integer NOT NULL DEFAULT 100,
	"due_date" timestamp,
	"time_limit_minutes" integer,
	"is_published" boolean NOT NULL DEFAULT false,
	"allow_late_submissions" boolean NOT NULL DEFAULT true,
	"created_by" uuid NOT NULL,
	"rubric" jsonb,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "submissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"week_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"reference_id" uuid NOT NULL,
	"content" text,
	"file_url" text,
	"score" integer,
	"max_score" integer NOT NULL,
	"feedback" text,
	"status" varchar(50) NOT NULL DEFAULT 'submitted',
	"submitted_at" timestamp NOT NULL DEFAULT now(),
	"graded_at" timestamp,
	"graded_by" uuid,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "lecture_materials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" varchar(50) NOT NULL,
	"content_url" text,
	"file_size" integer,
	"duration" integer,
	"order_index" integer NOT NULL DEFAULT 0,
	"is_published" boolean NOT NULL DEFAULT true,
	"created_at" timestamp NOT NULL DEFAULT now(),
	"updated_at" timestamp NOT NULL DEFAULT now()
);

ALTER TABLE "assignments" ADD CONSTRAINT "assignments_week_id_course_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."course_weeks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_week_id_course_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."course_weeks"("id") ON DELETE cascade ON UPDATE no action;
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_graded_by_users_id_fk" FOREIGN KEY ("graded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;

ALTER TABLE "lecture_materials" ADD CONSTRAINT "lecture_materials_week_id_course_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."course_weeks"("id") ON DELETE cascade ON UPDATE no action;
