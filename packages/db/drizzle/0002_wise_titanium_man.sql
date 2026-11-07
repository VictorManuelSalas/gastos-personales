CREATE TABLE "category_rule" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"pattern" text NOT NULL,
	"category_id" text NOT NULL,
	"origin" text DEFAULT 'manual' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "notification" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"key" text NOT NULL,
	"kind" text NOT NULL,
	"channel" text DEFAULT 'telegram' NOT NULL,
	"body" text NOT NULL,
	"sent_at" timestamp with time zone,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "telegram_link_token" (
	"token" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "pay_days" text DEFAULT '15,last' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "payday_policy" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_chat_id" text;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "telegram_linked_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "reminder_days" text DEFAULT '5,3,1,0' NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "quiet_start" integer DEFAULT 22 NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "quiet_end" integer DEFAULT 8 NOT NULL;--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "category_rule" ADD CONSTRAINT "category_rule_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "notification" ADD CONSTRAINT "notification_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "telegram_link_token" ADD CONSTRAINT "telegram_link_token_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "category_rule_user_pattern_uq" ON "category_rule" USING btree ("user_id","pattern");--> statement-breakpoint
CREATE UNIQUE INDEX "notification_key_uq" ON "notification" USING btree ("key");