CREATE TABLE "push_subscription" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"endpoint" text NOT NULL,
	"p256dh" text NOT NULL,
	"auth" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "push_subscription_endpoint_unique" UNIQUE("endpoint")
);
--> statement-breakpoint
CREATE TABLE "quincena_close" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"payday" date NOT NULL,
	"expected_cents" bigint NOT NULL,
	"actual_cents" bigint NOT NULL,
	"closed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "txn_split" (
	"id" text PRIMARY KEY NOT NULL,
	"txn_id" text NOT NULL,
	"category_id" text,
	"amount_cents" bigint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "notification" ADD COLUMN "read_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "summaries" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "log_reminder" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "push_subscription" ADD CONSTRAINT "push_subscription_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quincena_close" ADD CONSTRAINT "quincena_close_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn_split" ADD CONSTRAINT "txn_split_txn_id_txn_id_fk" FOREIGN KEY ("txn_id") REFERENCES "public"."txn"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn_split" ADD CONSTRAINT "txn_split_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "push_subscription_user_idx" ON "push_subscription" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "quincena_close_uq" ON "quincena_close" USING btree ("user_id","payday");--> statement-breakpoint
CREATE INDEX "txn_split_txn_idx" ON "txn_split" USING btree ("txn_id");