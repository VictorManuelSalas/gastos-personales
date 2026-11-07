import { assignPayday, billDueDates, today, type FlowItem, type ISODate, type PaydayRule } from "@gp/core";
import { db, recurringBill, transaction, type RecurringBill } from "@gp/db";
import { and, eq, isNotNull } from "drizzle-orm";
import { createLoan, recordTransaction } from "./mutations";

export async function userBills(userId: string) {
  return db.select().from(recurringBill).where(and(eq(recurringBill.userId, userId), eq(recurringBill.active, true))).orderBy(recurringBill.dayOfMonth);
}

async function paidPeriods(userId: string) {
  const rows = await db
    .select({ billId: transaction.billId, period: transaction.periodDate, amount: transaction.amountCents })
    .from(transaction)
    .where(and(eq(transaction.userId, userId), isNotNull(transaction.billId)));
  return new Map(rows.map((r) => [`${r.billId}|${r.period}`, r.amount]));
}

/** Renglones de Mis quincenas para servicios pagados desde cuenta o efectivo. */
export async function billItems(userId: string, rule: PaydayRule, from: ISODate, to: ISODate): Promise<FlowItem[]> {
  const [bills, paid] = await Promise.all([userBills(userId), paidPeriods(userId)]);
  const out: FlowItem[] = [];
  for (const b of bills) {
    if (b.creditLineId) continue;
    const since = from > today(undefined, b.createdAt) ? from : today(undefined, b.createdAt);
    for (const d of billDueDates(b, since, to)) {
      const done = paid.get(`${b.id}|${d}`);
      out.push({
        id: `b:${b.id}:${d}`,
        kind: "bill",
        label: b.name,
        date: d,
        payday: assignPayday(rule, d),
        amountCents: done ?? b.amountCents,
        direction: "out",
        status: done != null ? "done" : "pending",
        estimated: b.kind === "service" && done == null,
        ref: { billId: b.id, period: d, color: "#5fd0f3", accountId: b.accountId ?? "" },
      });
    }
  }
  return out;
}

/** Próximos vencimientos sin pagar (para avisos y la pantalla de servicios). */
export async function upcomingBills(userId: string, from: ISODate, to: ISODate) {
  const [bills, paid] = await Promise.all([userBills(userId), paidPeriods(userId)]);
  return bills.flatMap((b) => {
    // No hay vencimientos anteriores al alta del servicio.
    const created = today(undefined, b.createdAt);
    const since = from > created ? from : created;
    return billDueDates(b, since, to)
      .filter((d) => !paid.has(`${b.id}|${d}`))
      .map((d) => ({ bill: b, date: d }));
  });
}

/**
 * Paga un servicio: registra el gasto (cuenta o tarjeta) y, si se divide con alguien,
 * su parte queda en Me deben como "Le pagaste algo" (RN-23).
 */
export async function payBill(o: { userId: string; bill: RecurringBill; period: string; amountCents: number; accountId: string | null; lendingCategoryId: string | null }) {
  const id = await recordTransaction({
    userId: o.userId,
    kind: "expense",
    amountCents: o.amountCents,
    categoryId: o.bill.categoryId,
    accountId: o.bill.creditLineId ? null : o.accountId,
    creditLineId: o.bill.creditLineId,
    merchant: o.bill.name,
    note: o.bill.kind === "service" ? "Servicio" : "Suscripción",
  });
  await db.update(transaction).set({ billId: o.bill.id, periodDate: o.period }).where(eq(transaction.id, id));
  if (o.bill.splitContactId && o.bill.splitParts > 1) {
    const share = Math.round(o.amountCents / o.bill.splitParts);
    await createLoan({
      userId: o.userId,
      contactId: o.bill.splitContactId,
      kind: "paid_for",
      concept: `${o.bill.name} (${o.period.slice(0, 7)})`,
      amountCents: share,
      categoryId: o.lendingCategoryId,
    });
  }
  return id;
}
