"use server";

import { db, notification, pushSubscription, user } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { sendPush } from "@/server/notify/push";
import { newId, ok, str, type ActionState } from "./util";

export async function markAllReadAction() {
  const { user: u } = await requireUser();
  await db.update(notification).set({ readAt: new Date() }).where(and(eq(notification.userId, u.id), isNull(notification.readAt)));
  revalidatePath("/app", "layout");
}

/** Guarda la suscripción push del navegador (la manda el componente del cliente). */
export async function savePushSubscriptionAction(sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  const { user: u } = await requireUser();
  if (!sub?.endpoint?.startsWith("https://") || !sub.keys?.p256dh || !sub.keys?.auth) return { ok: false };
  await db
    .insert(pushSubscription)
    .values({ id: newId(), userId: u.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth })
    .onConflictDoUpdate({ target: pushSubscription.endpoint, set: { userId: u.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth } });
  const sent = await sendPush(u.id, { title: "Quincena", body: "Listo: aquí te llegarán tus avisos.", url: "/app/avisos", tag: "bienvenida" });
  return { ok: true, sent };
}

export async function updateNotifPrefsAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  await db
    .update(user)
    .set({ summaries: f.get("summaries") === "on", logReminder: f.get("logReminder") === "on" })
    .where(eq(user.id, u.id));
  revalidatePath("/app/ajustes");
  return ok();
}

export async function removePushAction(f: FormData) {
  const { user: u } = await requireUser();
  await db.delete(pushSubscription).where(and(eq(pushSubscription.userId, u.id), eq(pushSubscription.endpoint, str(f, "endpoint"))));
  revalidatePath("/app/ajustes");
}
