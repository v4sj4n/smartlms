DO $$ BEGIN
  CREATE TYPE "public"."learning_hub_item_type" AS ENUM ('goal', 'note', 'task', 'resource');
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_hubs" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "student_id" uuid NOT NULL,
  "title" text DEFAULT 'My Learning Hub' NOT NULL,
  "description" text,
  "focus" text,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "learning_hub_items" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "hub_id" uuid NOT NULL,
  "type" "public"."learning_hub_item_type" DEFAULT 'note' NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "due_at" timestamp,
  "is_completed" boolean DEFAULT false NOT NULL,
  "order_index" integer DEFAULT 0 NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL,
  "updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hubs"
    ADD CONSTRAINT "learning_hubs_student_id_users_id_fk"
    FOREIGN KEY ("student_id") REFERENCES "public"."users"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "learning_hub_items"
    ADD CONSTRAINT "learning_hub_items_hub_id_learning_hubs_id_fk"
    FOREIGN KEY ("hub_id") REFERENCES "public"."learning_hubs"("id")
    ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unq_learning_hubs_student" ON "learning_hubs" USING btree ("student_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_items_hub" ON "learning_hub_items" USING btree ("hub_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "idx_learning_hub_items_created_at" ON "learning_hub_items" USING btree ("created_at");
