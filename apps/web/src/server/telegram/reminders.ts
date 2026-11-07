import { remindersDue, today, TZ } from "@gp/core";
import { db, notification, user } from "@gp/db";
import { eq, isNotNull } from "drizzle-orm";
import { loadFinance, pendingPayments } from "@/server/finance/overview";
import { newId } from "@/server/actions/util";
import { sendMessage, telegramConfig } from "./client";

const hourIn = (tz = TZ, now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));

/**
 * Revisa a cada usuario con Telegram y envía los avisos que tocan ahora.
 * La clave única de `notification` garantiza que cada aviso salga una sola vez,
 * aunque el servidor se reinicie o el ciclo corra varias veces (RNF-10, CA-12).
 */
export async function runReminders(now = new Date()) {
  if (!telegramConfig()) return { users: 0, sent: 0 };
  const users = await db.select().from(user).where(isNotNull(user.telegramChatId));
  const date = today(TZ, now);
  const hour = hourIn(TZ, now);
  let sent = 0;

  for (const u of users) {
    try {
      const f = await loadFinance(u.id, date);
      const q = f.quincenas[0]!;
      const reminders = remindersDue({
        userId: u.id,
        today: date,
        hour,
        prefs: {
          days: u.reminderDays.split(",").map(Number).filter((n) => Number.isInteger(n)),
          quietStart: u.quietStart,
          quietEnd: u.quietEnd,
        },
        payments: pendingPayments(f),
        payday: {
          date: q.payday,
          inCents: q.inCents,
          outCents: q.outCents,
          endCents: q.endCents,
          count: q.items.filter((i) => i.direction === "out" && i.status === "pending").length,
        },
      });

      for (const r of reminders) {
        const [claimed] = await db
          .insert(notification)
          .values({ id: newId(), userId: u.id, key: r.key, kind: r.kind, body: r.text })
          .onConflictDoNothing()
          .returning({ id: notification.id });
        if (!claimed) continue; // ya enviado

        const res = await sendMessage(u.telegramChatId!, r.text, r.buttons);
        await db
          .update(notification)
          .set(res.ok ? { sentAt: new Date() } : { error: res.description ?? "Error" })
          .where(eq(notification.id, claimed.id));
        if (res.ok) sent++;
      }
    } catch (e) {
      console.error(`[avisos] usuario ${u.id}:`, e);
    }
  }
  return { users: users.length, sent };
}

const g = globalThis as unknown as { __gpReminderTimer?: ReturnType<typeof setInterval> };

/** Arranca la revisión cada 10 minutos (una sola vez por proceso). */
export function startReminderLoop() {
  if (g.__gpReminderTimer || process.env.REMINDERS === "off") return;
  const tick = () =>
    runReminders()
      .then((r) => r.sent && console.log(`[avisos] enviados: ${r.sent}`))
      .catch((e) => console.error("[avisos]", e));
  g.__gpReminderTimer = setInterval(tick, 10 * 60_000);
  setTimeout(tick, 15_000);
  console.log(telegramConfig() ? "[avisos] activos cada 10 min" : "[avisos] Telegram sin configurar; avisos en pausa");
}
