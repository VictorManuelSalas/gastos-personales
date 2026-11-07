import { db, pushSubscription } from "@gp/db";
import { eq } from "drizzle-orm";
import webpush from "web-push";

/** Notificaciones push de la PWA (Web Push con llaves VAPID). */
export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey, subject: process.env.VAPID_SUBJECT || "mailto:admin@quincena.local" };
}

/** Quita etiquetas HTML de los textos pensados para Telegram. */
export const plain = (html: string) => html.replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">");

/** Envía una notificación a todos los navegadores del usuario; borra suscripciones vencidas. */
export async function sendPush(userId: string, payload: { title: string; body: string; url?: string; tag?: string }) {
  const cfg = pushConfig();
  if (!cfg) return 0;
  webpush.setVapidDetails(cfg.subject, cfg.publicKey, cfg.privateKey);
  const subs = await db.select().from(pushSubscription).where(eq(pushSubscription.userId, userId));
  let sent = 0;
  for (const s of subs) {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        JSON.stringify({ title: payload.title, body: plain(payload.body), url: payload.url ?? "/app/avisos", tag: payload.tag }),
        { TTL: 60 * 60 * 24 },
      );
      sent++;
    } catch (e) {
      const status = (e as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) await db.delete(pushSubscription).where(eq(pushSubscription.id, s.id));
      else console.error("[push]", status, (e as Error).message);
    }
  }
  return sent;
}
