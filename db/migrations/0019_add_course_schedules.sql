CREATE TYPE "public"."day_of_week" AS ENUM('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');--> statement-breakpoint

CREATE TABLE "course_schedules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"course_id" uuid NOT NULL REFERENCES "courses"("id") ON DELETE CASCADE,
	"day_of_week" "day_of_week" NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"room" text,
	"building" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);--> statement-breakpoint

CREATE INDEX "course_schedules_course_id_idx" ON "course_schedules" ("course_id");--> statement-breakpoint
