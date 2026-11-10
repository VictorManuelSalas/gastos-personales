ALTER TABLE "user_ai_setting" DROP CONSTRAINT "user_ai_setting_pkey";--> statement-breakpoint
ALTER TABLE "user_ai_setting" ADD CONSTRAINT "user_ai_setting_user_id_provider_pk" PRIMARY KEY("user_id","provider");--> statement-breakpoint
ALTER TABLE "user_ai_setting" ADD COLUMN "is_primary" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- Hasta ahora había una sola fila por usuario: esa es su principal.
UPDATE "user_ai_setting" SET "is_primary" = true;
