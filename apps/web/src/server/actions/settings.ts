"use server";

import { randomBytes } from "node:crypto";
import { parsePaydayRule, serializePaydays } from "@gp/core";
import { db, telegramLinkToken, user } from "@gp/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { telegramConfig } from "@/server/telegram/client";
import { fail, int, ok, str, type ActionState } from "./util";

export async function updatePaydaysAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const rule = parsePaydayRule(str(f, "payDays"), str(f, "policy"));
  if (!rule) return fail('Escribe de 1 a 4 días separados por coma, por ejemplo "15, último" o "10, 25".');
  await db.update(user).set({ payDays: serializePaydays(rule), paydayPolicy: rule.policy ?? "none" }).where(eq(user.id, u.id));
  revalidatePath("/app", "layout");
  return ok();
}

export async function updateRemindersAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const days = str(f, "reminderDays")
    .split(/[,\s]+/)
    .filter(Boolean)
    .map(Number);
  if (!days.length || days.length > 6 || days.some((d) => !Number.isInteger(d) || d < 0 || d > 15)) {
    return fail('Escribe días entre 0 y 15 separados por coma, por ejemplo "5, 3, 1, 0".');
  }
  const quietStart = int(f, "quietStart", 0, 23);
  const quietEnd = int(f, "quietEnd", 0, 23);
  if (quietStart == null || quietEnd == null) return fail("Elige el horario de silencio.");
  await db
    .update(user)
    .set({ reminderDays: [...new Set(days)].sort((a, b) => b - a).join(","), quietStart, quietEnd })
    .where(eq(user.id, u.id));
  revalidatePath("/app/ajustes");
  return ok();
}

/** Crea un token de un solo uso y abre el bot con /start <token> (PRD 8, vincular Telegram). */
export async function connectTelegramAction() {
  const { user: u } = await requireUser();
  const cfg = telegramConfig();
  if (!cfg) return;
  const token = randomBytes(16).toString("base64url");
  await db.delete(telegramLinkToken).where(eq(telegramLinkToken.userId, u.id));
  await db.insert(telegramLinkToken).values({ token, userId: u.id, expiresAt: new Date(Date.now() + 15 * 60_000) });
  redirect(`https://t.me/${cfg.username}?start=${token}`);
}

export async function disconnectTelegramAction() {
  const { user: u } = await requireUser();
  await db.update(user).set({ telegramChatId: null, telegramLinkedAt: null }).where(eq(user.id, u.id));
  revalidatePath("/app/ajustes");
}

/** Admin: registra el webhook del bot en Telegram con la URL pública de la app. */
export async function registerWebhookAction(_p: ActionState, _f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  if (u.role !== "admin") return fail("Solo el administrador puede hacer esto.");
  const cfg = telegramConfig();
  const appUrl = process.env.BETTER_AUTH_URL ?? "";
  if (!cfg) return fail("Falta TELEGRAM_BOT_TOKEN y TELEGRAM_BOT_USERNAME en el archivo .env.");
  if (!appUrl.startsWith("https://")) return fail("Telegram necesita una URL pública con HTTPS. Configura APP_URL con tu dominio.");
  const { setWebhook } = await import("@/server/telegram/client");
  const res = await setWebhook(`${appUrl}/api/telegram`, cfg.secret);
  return res.ok ? ok() : fail(`Telegram respondió: ${res.description ?? "error desconocido"}`);
}
