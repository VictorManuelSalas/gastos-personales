CREATE TABLE "project" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"investment_cents" bigint DEFAULT 0 NOT NULL,
	"tag_id" text NOT NULL,
	"account_id" text,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "project_client" (
	"id" text PRIMARY KEY NOT NULL,
	"project_id" text NOT NULL,
	"name" text NOT NULL,
	"monthly_cents" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "recurring_bill" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"kind" text NOT NULL,
	"name" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"day_of_month" integer NOT NULL,
	"every_months" integer DEFAULT 1 NOT NULL,
	"anchor_month" integer,
	"account_id" text,
	"credit_line_id" text,
	"category_id" text,
	"split_contact_id" text,
	"split_parts" integer DEFAULT 1 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_expense" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"paid_by" text NOT NULL,
	"kind" text DEFAULT 'expense' NOT NULL,
	"concept" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"paid_to" text,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shared_share" (
	"expense_id" text NOT NULL,
	"user_id" text NOT NULL,
	"share_cents" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"created_by" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_goal" (
	"id" text PRIMARY KEY NOT NULL,
	"space_id" text NOT NULL,
	"name" text NOT NULL,
	"emoji" text DEFAULT '🎯' NOT NULL,
	"target_cents" bigint NOT NULL,
	"target_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_goal_contribution" (
	"id" text PRIMARY KEY NOT NULL,
	"goal_id" text NOT NULL,
	"user_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "space_member" (
	"space_id" text NOT NULL,
	"user_id" text NOT NULL,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "wishlist_item" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"product" text NOT NULL,
	"price_cents" bigint NOT NULL,
	"months" integer DEFAULT 1 NOT NULL,
	"credit_line_id" text,
	"note" text,
	"available_at" timestamp with time zone NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "txn" ADD COLUMN "bill_id" text;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_account_id_money_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_client" ADD CONSTRAINT "project_client_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_account_id_money_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."money_account"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_credit_line_id_credit_line_id_fk" FOREIGN KEY ("credit_line_id") REFERENCES "public"."credit_line"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "recurring_bill" ADD CONSTRAINT "recurring_bill_split_contact_id_contact_id_fk" FOREIGN KEY ("split_contact_id") REFERENCES "public"."contact"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expense" ADD CONSTRAINT "shared_expense_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expense" ADD CONSTRAINT "shared_expense_paid_by_user_id_fk" FOREIGN KEY ("paid_by") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_expense" ADD CONSTRAINT "shared_expense_paid_to_user_id_fk" FOREIGN KEY ("paid_to") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_share" ADD CONSTRAINT "shared_share_expense_id_shared_expense_id_fk" FOREIGN KEY ("expense_id") REFERENCES "public"."shared_expense"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shared_share" ADD CONSTRAINT "shared_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space" ADD CONSTRAINT "space_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_goal" ADD CONSTRAINT "space_goal_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_goal_contribution" ADD CONSTRAINT "space_goal_contribution_goal_id_space_goal_id_fk" FOREIGN KEY ("goal_id") REFERENCES "public"."space_goal"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_goal_contribution" ADD CONSTRAINT "space_goal_contribution_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_member" ADD CONSTRAINT "space_member_space_id_space_id_fk" FOREIGN KEY ("space_id") REFERENCES "public"."space"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "space_member" ADD CONSTRAINT "space_member_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "wishlist_item" ADD CONSTRAINT "wishlist_item_credit_line_id_credit_line_id_fk" FOREIGN KEY ("credit_line_id") REFERENCES "public"."credit_line"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "project_user_idx" ON "project" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "recurring_bill_user_idx" ON "recurring_bill" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "shared_expense_space_idx" ON "shared_expense" USING btree ("space_id");--> statement-breakpoint
CREATE UNIQUE INDEX "shared_share_uq" ON "shared_share" USING btree ("expense_id","user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "space_member_uq" ON "space_member" USING btree ("space_id","user_id");--> statement-breakpoint
CREATE INDEX "space_member_user_idx" ON "space_member" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "wishlist_user_idx" ON "wishlist_item" USING btree ("user_id");--> statement-breakpoint
ALTER TABLE "txn" ADD CONSTRAINT "txn_bill_id_recurring_bill_id_fk" FOREIGN KEY ("bill_id") REFERENCES "public"."recurring_bill"("id") ON DELETE set null ON UPDATE no action;