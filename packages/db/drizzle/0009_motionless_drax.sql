ALTER TABLE "cycle" ADD COLUMN "statement_at" timestamp with time zone;--> statement-breakpoint
-- Para los montos ya capturados, la mejor aproximación de cuándo se capturaron es su última modificación.
UPDATE "cycle" SET "statement_at" = "updated_at" WHERE "statement_cents" IS NOT NULL;
