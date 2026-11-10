ALTER TABLE "user" ADD COLUMN "last_login_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "blocked_at" timestamp with time zone;--> statement-breakpoint
-- Usuarios existentes: su último inicio de sesión es su sesión más reciente.
UPDATE "user" u SET "last_login_at" = s.last FROM (SELECT "user_id", max("created_at") AS last FROM "session" GROUP BY "user_id") s WHERE s."user_id" = u."id";
