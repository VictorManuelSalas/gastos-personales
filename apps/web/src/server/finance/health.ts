import { healthIndicators, installmentsDueAt, monthStart, today, type Indicator } from "@gp/core";
import { category, db, transaction } from "@gp/db";
import { and, eq, gte, inArray, lt } from "drizzle-orm";
import { avgEssentialMonthly } from "./goals";
import { receivableBalances } from "./mutations";
import { toInstallment, type Finance } from "./overview";

/** Ingreso mensual esperado: cada fuente × cobros al mes (o una vez si es mensual). */
export function monthlyIncome(f: Finance) {
  return f.sources.reduce((s, src) => s + src.expectedCents * (src.schedule === "monthly" ? 1 : f.rule.days.length), 0);
}

/** Cuotas MSI del ciclo actual de cada tarjeta. */
export function msiMonthly(f: Finance) {
  return f.lines
    .filter((l) => l.kind === "card")
    .reduce((s, l) => {
      const open = f.cycleViews.find((c) => c.lineId === l.id && c.status === "open");
      if (!open) return s;
      return s + installmentsDueAt(f.installments.filter((i) => i.creditLineId === l.id).map(toInstallment), open.cut);
    }, 0);
}

/** Datos reales del usuario → indicadores de salud financiera (PRD 7.8). */
export async function computeHealth(userId: string, f: Finance): Promise<{ indicators: Indicator[]; income: number; msi: number }> {
  const now = today();
  const lastMonthFrom = monthStart(now, -1);
  const lastMonthTo = monthStart(now);
  const d30 = new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);

  const [essential, spendRows, antRows, receivables] = await Promise.all([
    avgEssentialMonthly(userId, now),
    db
      .select({ kind: transaction.kind, amount: transaction.amountCents, accountId: transaction.accountId })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), inArray(transaction.kind, ["expense", "card_payment"]), gte(transaction.date, lastMonthFrom), lt(transaction.date, lastMonthTo))),
    db
      .select({ amount: transaction.amountCents })
      .from(transaction)
      .innerJoin(category, eq(transaction.categoryId, category.id))
      .where(and(eq(transaction.userId, userId), eq(transaction.kind, "expense"), eq(category.isAnt, true), gte(transaction.date, d30))),
    receivableBalances(userId),
  ]);

  const income = monthlyIncome(f);
  const msi = msiMonthly(f);
  const loans = f.lines.filter((l) => l.kind === "loan").reduce((s, l) => s + (l.fixedPaymentCents ?? 0), 0);
  const cards = f.lines.filter((l) => l.kind === "card" && l.creditLimitCents);
  const creditUsed = cards.reduce((s, l) => s + (f.cycleViews.find((c) => c.lineId === l.id && c.status === "open")?.amountCents ?? 0), 0);
  const creditLimit = cards.reduce((s, l) => s + (l.creditLimitCents ?? 0), 0);
  // Salida de dinero: gastos con cuenta (débito/efectivo) + pagos de tarjeta. Los gastos con tarjeta ya van en el pago.
  const spending = spendRows.filter((r) => r.kind === "card_payment" || r.accountId).reduce((s, r) => s + r.amount, 0);
  const emergency = f.goals.filter((g) => g.kind === "emergency").reduce((s, g) => s + g.savedCents, 0);

  return {
    income,
    msi,
    indicators: healthIndicators({
      monthlyIncomeCents: income,
      committedMonthlyCents: loans + msi,
      msiMonthlyCents: msi,
      creditUsedCents: creditUsed,
      creditLimitCents: creditLimit,
      emergencySavedCents: emergency,
      essentialMonthlyCents: essential,
      monthlySpendingCents: spending,
      antMonthlyCents: antRows.reduce((s, r) => s + r.amount, 0),
      lentCents: receivables.filter((r) => r.status === "active").reduce((s, r) => s + r.pendingCents, 0),
    }),
  };
}
