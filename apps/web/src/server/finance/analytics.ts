import { monthStart, type ISODate } from "@gp/core";
import { budget, category, creditLine, db, tag, transaction, transactionSplit, transactionTag } from "@gp/db";
import { and, eq, gte, inArray, lt } from "drizzle-orm";

export type MonthAnalytics = Awaited<ReturnType<typeof monthAnalytics>>;

/**
 * Gastos de un mes: por categoría, clase (50/30/20), tarjeta/cuenta, comercio y etiqueta,
 * más la tendencia de 6 meses y el avance de presupuestos.
 */
export async function monthAnalytics(userId: string, month: ISODate) {
  const from = monthStart(month);
  const to = monthStart(month, 1);
  const trendFrom = monthStart(month, -5);

  const [rawRows, trendRows, budgets, cats, tagRows] = await Promise.all([
    db
      .select({
        id: transaction.id,
        amount: transaction.amountCents,
        merchant: transaction.merchant,
        categoryId: transaction.categoryId,
        catName: category.name,
        emoji: category.emoji,
        klass: category.klass,
        isAnt: category.isAnt,
        lineName: creditLine.name,
        lineColor: creditLine.color,
        accountId: transaction.accountId,
      })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .leftJoin(creditLine, eq(transaction.creditLineId, creditLine.id))
      .where(and(eq(transaction.userId, userId), eq(transaction.kind, "expense"), gte(transaction.date, from), lt(transaction.date, to))),
    db
      .select({ amount: transaction.amountCents, date: transaction.date })
      .from(transaction)
      .where(and(eq(transaction.userId, userId), eq(transaction.kind, "expense"), gte(transaction.date, trendFrom), lt(transaction.date, to))),
    db.select().from(budget).where(eq(budget.userId, userId)),
    db.select().from(category).where(eq(category.userId, userId)),
    db
      .select({ tagName: tag.name, amount: transaction.amountCents })
      .from(transactionTag)
      .innerJoin(tag, eq(transactionTag.tagId, tag.id))
      .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id))
      .where(and(eq(tag.userId, userId), eq(transaction.kind, "expense"), gte(transaction.date, from), lt(transaction.date, to))),
  ]);

  // Gastos divididos (RF-14): cada parte cuenta en su propia categoría.
  const splits = rawRows.length
    ? await db.select().from(transactionSplit).where(inArray(transactionSplit.transactionId, rawRows.map((r) => r.id)))
    : [];
  const rows = rawRows.flatMap((r) => {
    const parts = splits.filter((sp) => sp.transactionId === r.id);
    if (!parts.length) return [r];
    return parts.map((sp) => {
      const c = cats.find((x) => x.id === sp.categoryId);
      return { ...r, amount: sp.amountCents, categoryId: sp.categoryId, catName: c?.name ?? null, emoji: c?.emoji ?? null, klass: c?.klass ?? null, isAnt: c?.isAnt ?? null };
    });
  });
  const parentName = (id: string | null) => {
    const c = cats.find((x) => x.id === id);
    const p = c?.parentId ? cats.find((x) => x.id === c.parentId) : null;
    return p ? `${p.name} › ${c!.name}` : (c?.name ?? null);
  };

  const total = rows.reduce((s, r) => s + r.amount, 0);
  const group = <K extends string>(key: (r: (typeof rows)[number]) => K) => {
    const m = new Map<K, number>();
    for (const r of rows) m.set(key(r), (m.get(key(r)) ?? 0) + r.amount);
    return [...m.entries()].map(([k, v]) => ({ key: k, cents: v })).sort((a, b) => b.cents - a.cents);
  };

  const byCategory = group((r) => r.categoryId ?? "none").map((g) => {
    const r = rows.find((x) => (x.categoryId ?? "none") === g.key);
    return { ...g, label: parentName(r?.categoryId ?? null) ?? "Sin categoría", emoji: r?.emoji ?? "•" };
  });
  const byClass = (["essential", "lifestyle", "savings"] as const).map((k) => ({
    key: k,
    cents: rows.filter((r) => (r.klass ?? "lifestyle") === k).reduce((s, r) => s + r.amount, 0),
  }));
  const bySource = group((r) => r.lineName ?? (r.accountId ? "Débito / efectivo" : "Sin cuenta"));
  const byMerchant = group((r) => (r.merchant ?? "").trim() || "Sin comercio").filter((g) => g.key !== "Sin comercio").slice(0, 8);
  const tagMap = new Map<string, number>();
  for (const t of tagRows) tagMap.set(t.tagName, (tagMap.get(t.tagName) ?? 0) + t.amount);
  const byTag = [...tagMap.entries()].map(([key, cents]) => ({ key, cents })).sort((a, b) => b.cents - a.cents);

  const trend = Array.from({ length: 6 }, (_, i) => {
    const m = monthStart(month, i - 5);
    const next = monthStart(month, i - 4);
    return { month: m, cents: trendRows.filter((r) => r.date >= m && r.date < next).reduce((s, r) => s + r.amount, 0) };
  });

  const budgetsView = budgets.map((b) => {
    const spent = b.categoryId
      ? rows
          .filter((r) => r.categoryId === b.categoryId || cats.find((c) => c.id === r.categoryId)?.parentId === b.categoryId)
          .reduce((s, r) => s + r.amount, 0)
      : rows.filter((r) => (r.klass ?? "lifestyle") === b.klass).reduce((s, r) => s + r.amount, 0);
    const c = cats.find((x) => x.id === b.categoryId);
    return { id: b.id, label: c ? `${c.emoji} ${c.name}` : b.klass === "essential" ? "Esenciales" : b.klass === "savings" ? "Ahorro y deuda" : "Estilo de vida", spent, limit: b.monthlyCents, categoryId: b.categoryId };
  });

  return {
    from,
    total,
    antCents: rows.filter((r) => r.isAnt).reduce((s, r) => s + r.amount, 0),
    count: rows.length,
    byCategory,
    byClass,
    bySource,
    byMerchant,
    byTag,
    trend,
    budgets: budgetsView,
  };
}
