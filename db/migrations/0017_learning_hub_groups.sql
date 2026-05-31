CREATE TABLE IF NOT EXISTS "learning_hub_groups" (
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
ALTER TABLE "learning_hub_groups" ADD COLUMN IF NOT EXISTS "is_discoverable" boolean DEFAULT true NOT NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_hub_group_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "user_id" uuid NOT NULL,
  "role" varchar(24) DEFAULT 'MEMBER' NOT NULL,
  "joined_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_hub_group_messages" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "group_id" uuid NOT NULL,
  "author_id" uuid NOT NULL,
  "content" text NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_groups"
    ADD CONSTRAINT "learning_hub_groups_hub_id_learning_hubs_id_fk"
    FOREIGN KEY ("hub_id") REFERENCES "public"."learning_hubs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_groups"
    ADD CONSTRAINT "learning_hub_groups_created_by_id_users_id_fk"
    FOREIGN KEY ("created_by_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_group_members"
    ADD CONSTRAINT "learning_hub_group_members_group_id_learning_hub_groups_id_fk"
    FOREIGN KEY ("group_id") REFERENCES "public"."learning_hub_groups"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_group_members"
    ADD CONSTRAINT "learning_hub_group_members_user_id_users_id_fk"
    FOREIGN KEY ("user_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_group_messages"
    ADD CONSTRAINT "learning_hub_group_messages_group_id_learning_hub_groups_id_fk"
    FOREIGN KEY ("group_id") REFERENCES "public"."learning_hub_groups"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_group_messages"
    ADD CONSTRAINT "learning_hub_group_messages_author_id_users_id_fk"
    FOREIGN KEY ("author_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_learning_hub_groups_join_code" ON "learning_hub_groups" USING btree ("join_code");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_learning_hub_group_member" ON "learning_hub_group_members" USING btree ("group_id","user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_groups_hub" ON "learning_hub_groups" USING btree ("hub_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_groups_creator" ON "learning_hub_groups" USING btree ("created_by_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_group_members_user" ON "learning_hub_group_members" USING btree ("user_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_group_messages_group_created_at" ON "learning_hub_group_messages" USING btree ("group_id","created_at");
--> statement-breakpoint
ALTER TABLE "files" ADD COLUMN IF NOT EXISTS "learning_hub_group_id" uuid;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "files"
    ADD CONSTRAINT "files_learning_hub_group_id_learning_hub_groups_id_fk"
    FOREIGN KEY ("learning_hub_group_id") REFERENCES "public"."learning_hub_groups"("id")
    ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_files_learning_hub_group" ON "files" USING btree ("learning_hub_group_id");
