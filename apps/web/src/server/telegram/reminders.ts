import {
  addDays,
  budgetStatus,
  diffDays,
  formatMXN,
  goalAtRisk,
  goalMilestone,
  inQuietHours,
  isUnusualExpense,
  monthStart,
  remindersDue,
  summaryDue,
  today,
  TZ,
  type Reminder,
} from "@gp/core";
import { category, db, notification, pushSubscription, transaction, user, wishlistItem, type User } from "@gp/db";
import { and, desc, eq, gt, gte, lte, ne, sql } from "drizzle-orm";
import { newId } from "@/server/actions/util";
import { monthAnalytics } from "@/server/finance/analytics";
import { upcomingBills } from "@/server/finance/bills";
import { receivableBalances } from "@/server/finance/mutations";
import { cardSummaries, loadFinance, pendingPayments, type Finance } from "@/server/finance/overview";
import { pushConfig, sendPush } from "@/server/notify/push";
import { sendMessage, telegramConfig } from "./client";

/** Un aviso con su canal: los de "bandeja" no se envían, solo quedan en la app. */
type Outgoing = Reminder & { inboxOnly?: boolean; title?: string };

const hourIn = (tz = TZ, now = new Date()) =>
  Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone: tz }).format(now));

const TITLES: Record<string, string> = {
  due: "Fecha límite",
  due_evening: "Vence hoy",
  overdue: "Pago vencido",
  cut: "Corte de tarjeta",
  payday: "Día de cobro",
};

/** Avisos de la Fase 4: resúmenes, metas, MSI, gasto inusual, uso de crédito y registro. */
async function extraReminders(u: User, f: Finance, date: string, hour: number, now: Date): Promise<Outgoing[]> {
  const out: Outgoing[] = [];

  // Resumen semanal (domingo 19:00) y mensual (día 1).
  const due = u.summaries ? summaryDue(date, hour) : null;
  if (due === "weekly") {
    const rows = await db
      .select({ amount: transaction.amountCents, cat: category.name, isAnt: category.isAnt })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .where(and(eq(transaction.userId, u.id), eq(transaction.kind, "expense"), gte(transaction.date, addDays(date, -6)), lte(transaction.date, date)));
    const total = rows.reduce((s, r) => s + r.amount, 0);
    const byCat = new Map<string, number>();
    for (const r of rows) byCat.set(r.cat ?? "Sin categoría", (byCat.get(r.cat ?? "Sin categoría") ?? 0) + r.amount);
    const top = [...byCat.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
    const ant = rows.filter((r) => r.isAnt).reduce((s, r) => s + r.amount, 0);
    const q = f.quincenas[0]!;
    out.push({
      key: `${u.id}:weekly:${date}`,
      kind: "payday",
      title: "Tu semana",
      text:
        `📊 Tu semana: gastaste <b>${formatMXN(total, { round: true })}</b>` +
        (top.length ? ` (más en ${top.map(([c, v]) => `${c} ${formatMXN(v, { round: true })}`).join(", ")})` : "") +
        `.${ant ? ` Antojos: ${formatMXN(ant, { round: true })}.` : ""}\nEn esta quincena te quedan <b>${formatMXN(q.endCents, { round: true })}</b>.`,
    });
  }
  if (due === "monthly") {
    const prev = monthStart(date, -1);
    const [a, b] = await Promise.all([monthAnalytics(u.id, prev), monthAnalytics(u.id, monthStart(date, -2))]);
    const delta = b.total > 0 ? Math.round(((a.total - b.total) / b.total) * 100) : null;
    const saved = f.goals.reduce((s, g) => s + g.savedCents, 0);
    out.push({
      key: `${u.id}:monthly:${date.slice(0, 7)}`,
      kind: "payday",
      title: "Tu mes",
      text:
        `🗓️ El mes pasado gastaste <b>${formatMXN(a.total, { round: true })}</b>` +
        (delta != null ? ` (${delta > 0 ? "+" : ""}${delta}% vs el anterior)` : "") +
        `. Más en ${a.byCategory[0]?.label ?? "—"}.` +
        (saved ? ` Llevas ${formatMXN(saved, { round: true })} apartados en metas.` : "") +
        " Revisa tu análisis en la app.",
    });
  }

  // Metas: hitos y riesgo.
  for (const g of f.goals) {
    const m = goalMilestone(g.progress);
    if (m) {
      out.push({
        key: `${u.id}:goal:${g.id}:${m}`,
        kind: "payday",
        title: "Meta",
        text: m === 100 ? `🎉 ¡Lograste tu meta ${g.emoji} ${g.name}!` : `🎉 ${g.emoji} ${g.name} llegó al ${m}%: ${formatMXN(g.savedCents, { round: true })}.`,
      });
    }
    if (goalAtRisk(g)) {
      out.push({
        key: `${u.id}:goal-risk:${g.id}:${date.slice(0, 7)}`,
        kind: "due",
        title: "Meta en riesgo",
        text: `⚠️ A este ritmo no llegas a ${g.emoji} ${g.name} a tiempo. Para lograrlo aparta ${formatMXN(g.suggestedCents ?? 0, { round: true })} por quincena, o ajusta la fecha en la app.`,
      });
    }
  }

  // MSI: última mensualidad.
  for (const s of cardSummaries(f)) {
    for (const m of s.msi) {
      if (m.progress.pending !== 1) continue;
      out.push({
        key: `${u.id}:msi:${m.row.id}:last`,
        kind: "payday",
        title: "MSI por terminar",
        text: `✅ ${m.row.product} en ${s.line.name}: queda la última mensualidad. Desde el próximo mes se liberan <b>${formatMXN(m.progress.monthly)}</b>; considera mandarlos a tu fondo de emergencia.`,
      });
    }
  }

  // Gasto inusual: registrados en las últimas 24 h, más del doble del promedio de su categoría.
  const recent = await db
    .select()
    .from(transaction)
    .where(and(eq(transaction.userId, u.id), eq(transaction.kind, "expense"), gt(transaction.createdAt, new Date(now.getTime() - 86_400_000))));
  for (const t of recent) {
    if (!t.categoryId) continue;
    const prev = await db
      .select({ amount: transaction.amountCents })
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, u.id),
          eq(transaction.kind, "expense"),
          eq(transaction.categoryId, t.categoryId),
          ne(transaction.id, t.id),
          gte(transaction.date, addDays(date, -90)),
        ),
      );
    if (isUnusualExpense(t.amountCents, prev.map((p) => p.amount))) {
      out.push({
        key: `${u.id}:unusual:${t.id}`,
        kind: "due",
        title: "Gasto inusual",
        text: `👀 ${t.merchant ?? "Un gasto"} de ${formatMXN(t.amountCents)} es más del doble de lo normal en esa categoría. Si está bien, ignora este aviso.`,
      });
    }
  }

  // Uso alto de crédito (solo bandeja).
  for (const l of f.lines) {
    if (l.kind !== "card" || !l.creditLimitCents) continue;
    const open = f.cycleViews.find((c) => c.lineId === l.id && c.status === "open");
    if (!open || open.amountCents / l.creditLimitCents <= 0.3) continue;
    out.push({
      key: `${u.id}:util:${l.id}:${date.slice(0, 7)}`,
      kind: "due",
      title: "Uso de crédito",
      inboxOnly: true,
      text: `${l.name} va en ${Math.round((open.amountCents / l.creditLimitCents) * 100)}% de su límite. Arriba de 30% puede afectar tu historial.`,
    });
  }

  // "¿Gastaste algo hoy?" tras 2 días sin registros (opcional).
  if (u.logReminder && hour >= 20) {
    const [last] = await db.select({ d: transaction.createdAt }).from(transaction).where(eq(transaction.userId, u.id)).orderBy(desc(transaction.createdAt)).limit(1);
    if (!last || now.getTime() - last.d.getTime() > 2 * 86_400_000) {
      out.push({ key: `${u.id}:log:${date}`, kind: "due", title: "¿Gastaste algo?", text: "✍️ Llevas 2 días sin registrar. ¿Gastaste algo hoy? Escríbeme, por ejemplo: <b>tacos 180</b>." });
    }
  }
  return out;
}

/**
 * Revisa a cada usuario y envía los avisos que tocan ahora por Telegram y push;
 * todos quedan en la bandeja de la app. La clave única de `notification` garantiza
 * que cada aviso salga una sola vez (RNF-10, CA-12).
 */
export async function runReminders(now = new Date()) {
  const tg = telegramConfig();
  const push = pushConfig();
  const users = await db.select().from(user);
  const date = today(TZ, now);
  const hour = hourIn(TZ, now);
  let sent = 0;

  for (const u of users) {
    try {
      const f = await loadFinance(u.id, date);
      const q = f.quincenas[0]!;
      const prefs = { quietStart: u.quietStart, quietEnd: u.quietEnd };
      const reminders: Outgoing[] = remindersDue({
        userId: u.id,
        today: date,
        hour,
        prefs: { days: u.reminderDays.split(",").map(Number).filter((n) => Number.isInteger(n)), ...prefs },
        payments: pendingPayments(f),
        payday: {
          date: q.payday,
          inCents: q.inCents,
          outCents: q.outCents,
          endCents: q.endCents,
          count: q.items.filter((i) => i.direction === "out" && i.status === "pending").length,
        },
      });

      if (!inQuietHours(hour, prefs) && hour >= 9) {
        // Presupuestos (PRD 7.7): un aviso al 80% y otro al 100%, una vez por mes.
        const month = monthStart(date);
        for (const b of (await monthAnalytics(u.id, month)).budgets) {
          const st = budgetStatus(b.spent, b.limit);
          if (st.level === "good") continue;
          const level = st.level === "bad" ? "100" : "80";
          reminders.push({
            key: `${u.id}:budget:${b.id}:${month}:${level}`,
            kind: "due",
            title: "Presupuesto",
            text:
              level === "100"
                ? `🔴 Te pasaste del presupuesto de ${b.label}: ${formatMXN(b.spent, { round: true })} de ${formatMXN(b.limit, { round: true })} este mes.`
                : `🟡 Vas en ${st.pct}% del presupuesto de ${b.label}: ${formatMXN(b.spent, { round: true })} de ${formatMXN(b.limit, { round: true })}.`,
          });
        }

        // Servicios y suscripciones: 3 días antes y el mismo día.
        for (const { bill, date: due } of await upcomingBills(u.id, date, addDays(date, 3))) {
          const left = diffDays(date, due);
          if (left !== 3 && left !== 0) continue;
          reminders.push({
            key: `${u.id}:bill:${bill.id}:${due}:${left}`,
            kind: "due",
            title: "Servicio por vencer",
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
            title: "Lista de deseos",
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
              title: "Me deben",
              text: `🤝 Te deben ${formatMXN(total)} en ${open.length} préstamos. Revisa Me deben en la app; ahí puedes copiar un recordatorio amable para cada persona.`,
            });
          }
        }

        reminders.push(...(await extraReminders(u, f, date, hour, now)));
      }

      const [{ n: subs } = { n: 0 }] = push
        ? await db.select({ n: sql<number>`count(*)::int` }).from(pushSubscription).where(eq(pushSubscription.userId, u.id))
        : [{ n: 0 }];

      for (const r of reminders) {
        const [claimed] = await db
          .insert(notification)
          .values({ id: newId(), userId: u.id, key: r.key, kind: r.kind, body: r.text })
          .onConflictDoNothing()
          .returning({ id: notification.id });
        if (!claimed) continue; // ya enviado
        if (r.inboxOnly) {
          await db.update(notification).set({ sentAt: new Date() }).where(eq(notification.id, claimed.id));
          continue;
        }

        let ok = false;
        let error: string | null = null;
        if (tg && u.telegramChatId) {
          const res = await sendMessage(u.telegramChatId, r.text, r.buttons);
          ok = res.ok;
          if (!res.ok) error = res.description ?? "Error de Telegram";
        }
        if (subs > 0) ok = (await sendPush(u.id, { title: r.title ?? TITLES[r.kind] ?? "Quincena", body: r.text, tag: r.key })) > 0 || ok;
        await db
          .update(notification)
          .set(ok || (!u.telegramChatId && subs === 0) ? { sentAt: new Date() } : { error })
          .where(eq(notification.id, claimed.id));
        if (ok) sent++;
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
  const channels = [telegramConfig() && "Telegram", pushConfig() && "push", "bandeja"].filter(Boolean).join(", ");
  console.log(`[avisos] activos cada 10 min (${channels})`);
}
