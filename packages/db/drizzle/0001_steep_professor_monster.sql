CREATE TABLE "category" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"parent_id" text,
	"name" text NOT NULL,
	"emoji" text DEFAULT '•' NOT NULL,
	"color" text DEFAULT '#8fa8ff' NOT NULL,
	"kind" text NOT NULL,
	"class" text DEFAULT 'lifestyle' NOT NULL,
	"is_ant" boolean DEFAULT false NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"archived_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "credit_line" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"color" text DEFAULT '#8fa8ff' NOT NULL,
	"cut_day" integer NOT NULL,
	"due_kind" text NOT NULL,
	"due_value" integer NOT NULL,
	"business_day_policy" text DEFAULT 'none' NOT NULL,
	"credit_limit_cents" bigint,
	"fixed_payment_cents" bigint,
	"remaining_payments" integer,
	"tracking_from" date NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cycle" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credit_line_id" text NOT NULL,
	"cut_date" date NOT NULL,
	"due_override" date,
	"statement_cents" bigint,
	"minimum_cents" bigint,
	"payday_override" date,
	"paid_at" date,
	"paid_cents" bigint,
	"note" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "income_source" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"account_id" text,
	"expected_cents" bigint NOT NULL,
	"estimation" text DEFAULT 'fixed' NOT NULL,
	"schedule" text DEFAULT 'paydays' NOT NULL,
	"monthly_day" integer,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "installment" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"credit_line_id" text NOT NULL,
	"product" text NOT NULL,
	"price_cents" bigint NOT NULL,
	"months" integer NOT NULL,
	"monthly_cents" bigint,
	"first_cut" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "money_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"balance_cents" bigint DEFAULT 0 NOT NULL,
	"in_available" boolean DEFAULT true NOT NULL,
	"is_default" boolean DEFAULT false NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "txn" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"date" date NOT NULL,
	"category_id" text,
	"account_id" text,
	"credit_line_id" text,
	"period_date" date,
	"income_source_id" text,
	"merchant" text,
	"note" text,
	"origin" text DEFAULT 'web' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "credit_line" ADD CONSTRAINT "credit_line_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle" ADD CONSTRAINT "cycle_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cycle" ADD CONSTRAINT "cycle_credit_line_id_credit_line_id_fk" FOREIGN KEY ("credit_line_id") REFERENCES "public"."credit_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_source" ADD CONSTRAINT "income_source_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "income_source" ADD CONSTRAINT "income_source_account_id_money_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "installment" ADD CONSTRAINT "installment_credit_line_id_credit_line_id_fk" FOREIGN KEY ("credit_line_id") REFERENCES "public"."credit_line"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "money_account" ADD CONSTRAINT "money_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_account_id_money_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_credit_line_id_credit_line_id_fk" FOREIGN KEY ("credit_line_id") REFERENCES "public"."credit_line"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_income_source_id_income_source_id_fk" FOREIGN KEY ("income_source_id") REFERENCES "public"."income_source"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "category_user_idx" ON "category" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "credit_line_user_idx" ON "credit_line" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cycle_line_cut_uq" ON "cycle" USING btree ("credit_line_id","cut_date");--> statement-breakpoint
CREATE INDEX "cycle_user_idx" ON "cycle" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "income_source_user_idx" ON "income_source" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "installment_user_idx" ON "installment" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "money_account_user_idx" ON "money_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "txn_user_date_idx" ON "txn" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "txn_line_idx" ON "txn" USING btree ("credit_line_id","date");