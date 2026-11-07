import { addDays, budgetStatus, diffDays, formatMXN, inQuietHours, monthStart, remindersDue, today, TZ, type Reminder } from "@gp/core";
import { db, notification, user, wishlistItem } from "@gp/db";
import { and, eq, isNotNull, lte } from "drizzle-orm";
import { monthAnalytics } from "@/server/finance/analytics";
import { upcomingBills } from "@/server/finance/bills";
import { receivableBalances } from "@/server/finance/mutations";
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

      // Presupuestos (PRD 7.7): un aviso al llegar al 80% y otro al 100%, una vez por mes.
      const prefs = { quietStart: u.quietStart, quietEnd: u.quietEnd };
      if (!inQuietHours(hour, prefs) && hour >= 9) {
        const month = monthStart(date);
        const a = await monthAnalytics(u.id, month);
        for (const b of a.budgets) {
          const st = budgetStatus(b.spent, b.limit);
          if (st.level === "good") continue;
          const level = st.level === "bad" ? "100" : "80";
          const budgetReminder: Reminder = {
            key: `${u.id}:budget:${b.id}:${month}:${level}`,
            kind: "due",
            text:
              level === "100"
                ? `🔴 Te pasaste del presupuesto de ${b.label}: ${formatMXN(b.spent, { round: true })} de ${formatMXN(b.limit, { round: true })} este mes.`
                : `🟡 Vas en ${st.pct}% del presupuesto de ${b.label}: ${formatMXN(b.spent, { round: true })} de ${formatMXN(b.limit, { round: true })}.`,
          };
          reminders.push(budgetReminder);
        }
      }

      if (!inQuietHours(hour, prefs) && hour >= 9) {
        // Servicios y suscripciones: 3 días antes y el mismo día.
        for (const { bill, date: due } of await upcomingBills(u.id, date, addDays(date, 3))) {
          const left = diffDays(date, due);
          if (left !== 3 && left !== 0) continue;
          reminders.push({
            key: `${u.id}:bill:${bill.id}:${due}:${left}`,
            kind: "due",
            text: `🧾 ${bill.name} ${left === 0 ? "vence <b>hoy</b>" : "vence en 3 días"}: ${formatMXN(bill.amountCents)}${bill.splitParts > 1 ? ` (se divide entre ${bill.splitParts})` : ""}.`,
          });
        }

        // Lista de deseos: ya pasaron las 72 h.
        const ready = await db
          .select()
          .from(wishlistItem)
          .where(and(eq(wishlistItem.userId, u.id), eq(wishlistItem.status, "waiting"), lte(wishlistItem.availableAt, now)));
        for (const w of ready) {
          reminders.push({
            key: `${u.id}:wish:${w.id}`,
            kind: "due",
            text: `⏳ Ya pasaron 72 horas. ¿Todavía quieres <b>${w.product}</b> (${formatMXN(w.priceCents)})? Antes de comprar prueba /simula.`,
            buttons: [
              ["Lo compré", `wish:${w.id}:bought`],
              ["Ya no lo quiero", `wish:${w.id}:dropped`],
            ],
          });
        }

        // Me deben: resumen el día 1 de cada mes.
        if (date.endsWith("-01")) {
          const open = (await receivableBalances(u.id)).filter((r) => r.status === "active" && r.pendingCents > 0);
          const total = open.reduce((s, r) => s + r.pendingCents, 0);
          if (total > 0) {
            reminders.push({
              key: `${u.id}:medeben:${date.slice(0, 7)}`,
              kind: "due",
              text: `🤝 Te deben ${formatMXN(total)} en ${open.length} préstamos. Revisa Me deben en la app; ahí puedes copiar un recordatorio amable para cada persona.`,
            });
          }
        }
      }

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
