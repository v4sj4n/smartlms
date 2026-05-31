CREATE TYPE "public"."ai_model_type" AS ENUM('text', 'embedding');--> statement-breakpoint
CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'google', 'mistral', 'groq', 'xai', 'cohere', 'deepseek', 'fireworks', 'togetherai', 'perplexity', 'local', 'ollama', 'lm-studio');--> statement-breakpoint
CREATE TYPE "public"."ai_provider_status" AS ENUM('enabled', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."assignment_origin" AS ENUM('manual', 'ai_generated');--> statement-breakpoint
CREATE TYPE "public"."assignment_submission_type" AS ENUM('text', 'file', 'both');--> statement-breakpoint
CREATE TYPE "public"."learning_hub_item_type" AS ENUM('goal', 'note', 'task', 'resource');--> statement-breakpoint
CREATE TYPE "public"."user_ai_tone" AS ENUM('Default', 'Professional', 'Friendly', 'Candid', 'Quirky', 'Efficient', 'Cynical');--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" text PRIMARY KEY NOT NULL,
	"provider_id" text NOT NULL,
	"model_name" text NOT NULL,
	"model_identifier" text NOT NULL,
	"model_type" "ai_model_type" NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_providers" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"status" "ai_provider_status" DEFAULT 'enabled' NOT NULL,
	"local" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_settings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"chat_provider" "ai_provider" DEFAULT 'google' NOT NULL,
	"chat_model_id" varchar(128) DEFAULT 'gemini-2.0-flash-001' NOT NULL,
	"chat_api_key" text,
	"chat_base_url" text,
	"chat_temperature" varchar(10) DEFAULT '0.7',
	"chat_max_tokens" integer DEFAULT 4096,
	"embedding_provider" "ai_provider" DEFAULT 'google' NOT NULL,
	"embedding_model_id" varchar(128) DEFAULT 'gemini-embedding-001' NOT NULL,
	"embedding_api_key" text,
	"embedding_base_url" text,
	"embedding_dimensions" integer DEFAULT 1024,
	"is_enabled" boolean DEFAULT true NOT NULL,
	"allow_file_uploads" boolean DEFAULT true NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"updated_by" uuid
);
--> statement-breakpoint
CREATE TABLE "assignments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"week_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"type" "assignment_type" DEFAULT 'homework' NOT NULL,
	"origin" "assignment_origin" DEFAULT 'manual' NOT NULL,
	"source_file_id" uuid,
	"submission_type" "assignment_submission_type" DEFAULT 'both' NOT NULL,
	"max_score" integer DEFAULT 100 NOT NULL,
	"due_date" timestamp,
	"time_limit_minutes" integer,
	"is_published" boolean DEFAULT false NOT NULL,
	"allow_late_submissions" boolean DEFAULT true NOT NULL,
	"created_by" uuid NOT NULL,
	"rubric" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_hub_group_members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" varchar(24) DEFAULT 'MEMBER' NOT NULL,
	"joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_hub_group_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"group_id" uuid NOT NULL,
	"author_id" uuid NOT NULL,
	"content" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_hub_groups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"created_by_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"join_code" varchar(12) NOT NULL,
	"is_discoverable" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_hub_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"hub_id" uuid NOT NULL,
	"type" "learning_hub_item_type" DEFAULT 'note' NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"due_at" timestamp,
	"is_completed" boolean DEFAULT false NOT NULL,
	"order_index" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "learning_hubs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"student_id" uuid NOT NULL,
	"title" text DEFAULT 'My Learning Hub' NOT NULL,
	"description" text,
	"focus" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_answers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"attempt_id" uuid NOT NULL,
	"question_id" uuid NOT NULL,
	"selected_option_id" uuid NOT NULL,
	"is_correct" boolean NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_attempts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"quiz_id" uuid NOT NULL,
	"score" integer DEFAULT 0 NOT NULL,
	"completed_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "file_chunks" ALTER COLUMN "embedding" SET DATA TYPE vector(1024);--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN "learning_hub_group_id" uuid;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_tone" "user_ai_tone" DEFAULT 'Default' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "ai_custom_instructions" text;--> statement-breakpoint
ALTER TABLE "ai_models" ADD CONSTRAINT "ai_models_provider_id_ai_providers_id_fk" FOREIGN KEY ("provider_id") REFERENCES "public"."ai_providers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_settings" ADD CONSTRAINT "ai_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_week_id_course_weeks_id_fk" FOREIGN KEY ("week_id") REFERENCES "public"."course_weeks"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "assignments" ADD CONSTRAINT "assignments_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_group_members" ADD CONSTRAINT "learning_hub_group_members_group_id_learning_hub_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."learning_hub_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_group_members" ADD CONSTRAINT "learning_hub_group_members_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_group_messages" ADD CONSTRAINT "learning_hub_group_messages_group_id_learning_hub_groups_id_fk" FOREIGN KEY ("group_id") REFERENCES "public"."learning_hub_groups"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_group_messages" ADD CONSTRAINT "learning_hub_group_messages_author_id_users_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_groups" ADD CONSTRAINT "learning_hub_groups_hub_id_learning_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."learning_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_groups" ADD CONSTRAINT "learning_hub_groups_created_by_id_users_id_fk" FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hub_items" ADD CONSTRAINT "learning_hub_items_hub_id_learning_hubs_id_fk" FOREIGN KEY ("hub_id") REFERENCES "public"."learning_hubs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "learning_hubs" ADD CONSTRAINT "learning_hubs_student_id_users_id_fk" FOREIGN KEY ("student_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_attempt_id_quiz_attempts_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_question_id_questions_id_fk" FOREIGN KEY ("question_id") REFERENCES "public"."questions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_answers" ADD CONSTRAINT "quiz_answers_selected_option_id_question_options_id_fk" FOREIGN KEY ("selected_option_id") REFERENCES "public"."question_options"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempts" ADD CONSTRAINT "quiz_attempts_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "unq_ai_models_provider_identifier" ON "ai_models" USING btree ("provider_id","model_identifier");--> statement-breakpoint
CREATE INDEX "idx_ai_models_provider" ON "ai_models" USING btree ("provider_id");--> statement-breakpoint
CREATE INDEX "idx_ai_models_type" ON "ai_models" USING btree ("model_type");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_learning_hub_group_member" ON "learning_hub_group_members" USING btree ("group_id","user_id");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_group_members_user" ON "learning_hub_group_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_group_messages_group_created_at" ON "learning_hub_group_messages" USING btree ("group_id","created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_learning_hub_groups_join_code" ON "learning_hub_groups" USING btree ("join_code");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_groups_hub" ON "learning_hub_groups" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_groups_creator" ON "learning_hub_groups" USING btree ("created_by_id");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_items_hub" ON "learning_hub_items" USING btree ("hub_id");--> statement-breakpoint
CREATE INDEX "idx_learning_hub_items_created_at" ON "learning_hub_items" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_learning_hubs_student" ON "learning_hubs" USING btree ("student_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_quiz_answer_attempt_question" ON "quiz_answers" USING btree ("attempt_id","question_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_user_quiz_idx" ON "quiz_attempts" USING btree ("user_id","quiz_id");--> statement-breakpoint
CREATE INDEX "quiz_attempts_completed_at_idx" ON "quiz_attempts" USING btree ("completed_at");--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_learning_hub_group_id_learning_hub_groups_id_fk" FOREIGN KEY ("learning_hub_group_id") REFERENCES "public"."learning_hub_groups"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_files_learning_hub_group" ON "files" USING btree ("learning_hub_group_id");