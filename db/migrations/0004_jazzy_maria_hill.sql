CREATE TYPE "public"."chatbot_role" AS ENUM('system', 'user', 'assistant');--> statement-breakpoint
CREATE TYPE "public"."content_status" AS ENUM('DRAFT', 'PENDING_REVIEW', 'PUBLISHED', 'ARCHIVED');--> statement-breakpoint
CREATE TYPE "public"."difficulty" AS ENUM('easy', 'medium', 'hard');--> statement-breakpoint
CREATE TYPE "public"."file_status" AS ENUM('UPLOADING', 'UPLOADED', 'PROCESSING', 'READY', 'FAILED', 'DELETED');--> statement-breakpoint
CREATE TYPE "public"."generation_origin" AS ENUM('MANUAL', 'AI');--> statement-breakpoint
CREATE TYPE "public"."quiz_question_type" AS ENUM('mcq', 'true_false', 'short_answer');--> statement-breakpoint
CREATE TABLE "chatbot_conversations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"chatbot_id" uuid NOT NULL,
	"title" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbot_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"conversation_id" uuid NOT NULL,
	"role" "chatbot_role" NOT NULL,
	"content" text NOT NULL,
	"citations" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"token_usage" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "chatbots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"subject_id" uuid NOT NULL,
	"system_prompt" text NOT NULL,
	"model" varchar(64) DEFAULT 'gpt-4.1-mini' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "club_message_reactions" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"emoji" varchar(32) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "club_message_reactions_message_id_user_id_emoji_pk" PRIMARY KEY("message_id","user_id","emoji")
);
--> statement-breakpoint
CREATE TABLE "club_message_reads" (
	"message_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"read_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "club_message_reads_message_id_user_id_pk" PRIMARY KEY("message_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "file_chunks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"file_id" uuid NOT NULL,
	"chunk_index" integer NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" vector(1536) NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"mime_type" varchar(128) NOT NULL,
	"size" integer NOT NULL,
	"path" text NOT NULL,
	"uploaded_by" uuid,
	"subject_id" uuid,
	"week_number" integer,
	"club_id" uuid,
	"status" "file_status" DEFAULT 'UPLOADED' NOT NULL,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"deleted_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "quiz_questions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"quiz_id" uuid NOT NULL,
	"type" "quiz_question_type" NOT NULL,
	"prompt" text NOT NULL,
	"options" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"answer" jsonb NOT NULL,
	"explanation" text,
	"difficulty" "difficulty" DEFAULT 'medium' NOT NULL,
	"source_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"fingerprint" varchar(64) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "club_members" ADD COLUMN "last_read_message_id" uuid;--> statement-breakpoint
ALTER TABLE "club_members" ADD COLUMN "muted_until" timestamp;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN "attachments" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN "mentioned_user_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN "reply_to_id" uuid;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN "edited_at" timestamp;--> statement-breakpoint
ALTER TABLE "club_messages" ADD COLUMN "deleted_at" timestamp;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "source_file_id" uuid;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "origin" "generation_origin" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "status" "content_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "difficulty" "difficulty" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "source_chunk_ids" jsonb DEFAULT '[]'::jsonb NOT NULL;--> statement-breakpoint
ALTER TABLE "flashcards" ADD COLUMN "fingerprint" varchar(64);--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "source_file_id" uuid;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "origin" "generation_origin" DEFAULT 'MANUAL' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "status" "content_status" DEFAULT 'DRAFT' NOT NULL;--> statement-breakpoint
ALTER TABLE "quizzes" ADD COLUMN "difficulty" "difficulty" DEFAULT 'medium' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "nickname" varchar(64);--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "bio" text;--> statement-breakpoint
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_conversations" ADD CONSTRAINT "chatbot_conversations_chatbot_id_chatbots_id_fk" FOREIGN KEY ("chatbot_id") REFERENCES "public"."chatbots"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbot_messages" ADD CONSTRAINT "chatbot_messages_conversation_id_chatbot_conversations_id_fk" FOREIGN KEY ("conversation_id") REFERENCES "public"."chatbot_conversations"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "chatbots" ADD CONSTRAINT "chatbots_subject_id_courses_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."courses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_message_reactions" ADD CONSTRAINT "club_message_reactions_message_id_club_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."club_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_message_reactions" ADD CONSTRAINT "club_message_reactions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_message_reads" ADD CONSTRAINT "club_message_reads_message_id_club_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."club_messages"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_message_reads" ADD CONSTRAINT "club_message_reads_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "file_chunks" ADD CONSTRAINT "file_chunks_file_id_files_id_fk" FOREIGN KEY ("file_id") REFERENCES "public"."files"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_subject_id_courses_id_fk" FOREIGN KEY ("subject_id") REFERENCES "public"."courses"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "files" ADD CONSTRAINT "files_club_id_clubs_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."clubs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_questions" ADD CONSTRAINT "quiz_questions_quiz_id_quizzes_id_fk" FOREIGN KEY ("quiz_id") REFERENCES "public"."quizzes"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_chatbot_conversations_user" ON "chatbot_conversations" USING btree ("user_id","updated_at");--> statement-breakpoint
CREATE INDEX "idx_chatbot_messages_conv_created" ON "chatbot_messages" USING btree ("conversation_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_club_message_reactions_message" ON "club_message_reactions" USING btree ("message_id");--> statement-breakpoint
CREATE INDEX "idx_club_message_reads_user" ON "club_message_reads" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_file_chunks_file_index" ON "file_chunks" USING btree ("file_id","chunk_index");--> statement-breakpoint
CREATE INDEX "idx_file_chunks_file" ON "file_chunks" USING btree ("file_id");--> statement-breakpoint
CREATE INDEX "idx_files_subject_week" ON "files" USING btree ("subject_id","week_number");--> statement-breakpoint
CREATE INDEX "idx_files_club" ON "files" USING btree ("club_id");--> statement-breakpoint
CREATE INDEX "idx_files_uploaded_by" ON "files" USING btree ("uploaded_by");--> statement-breakpoint
CREATE UNIQUE INDEX "unq_quiz_questions_fingerprint" ON "quiz_questions" USING btree ("quiz_id","fingerprint");--> statement-breakpoint
CREATE INDEX "idx_quiz_questions_quiz" ON "quiz_questions" USING btree ("quiz_id");--> statement-breakpoint
ALTER TABLE "flashcards" ADD CONSTRAINT "flashcards_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quizzes" ADD CONSTRAINT "quizzes_source_file_id_files_id_fk" FOREIGN KEY ("source_file_id") REFERENCES "public"."files"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_club_members_user" ON "club_members" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "idx_club_messages_club_created_at" ON "club_messages" USING btree ("club_id","created_at");--> statement-breakpoint
CREATE INDEX "idx_club_messages_reply_to" ON "club_messages" USING btree ("reply_to_id");