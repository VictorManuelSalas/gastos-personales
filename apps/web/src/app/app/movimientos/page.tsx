import { formatMXN, monthStart, today } from "@gp/core";
import { category, creditLine, db, moneyAccount, transaction } from "@gp/db";
import { and, desc, eq, gte, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { TxnForm } from "@/components/finance/txn-form";
import { ActionButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { deleteTxnAction } from "@/server/actions/money";
import { ensureDefaultCategories } from "@/server/finance/defaults";

export const metadata: Metadata = { title: "Movimientos" };

const KIND_LABEL = { expense: "Gasto", income: "Ingreso", card_payment: "Pago de tarjeta", adjustment: "Ajuste" } as const;

export default async function MovementsPage() {
  const { user } = await requireUser();
  await ensureDefaultCategories(user.id);
  const now = today();
  const monthFrom = monthStart(now);

  const [cats, accounts, lines, txns] = await Promise.all([
    db.select().from(category).where(and(eq(category.userId, user.id), isNull(category.archivedAt))).orderBy(category.sortOrder, category.name),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))).orderBy(desc(moneyAccount.isDefault)),
    db.select().from(creditLine).where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
    db
      .select({
        t: transaction,
        catName: category.name,
        catEmoji: category.emoji,
        accName: moneyAccount.name,
        lineName: creditLine.name,
        lineColor: creditLine.color,
      })
      .from(transaction)
      .leftJoin(category, eq(transaction.categoryId, category.id))
      .leftJoin(moneyAccount, eq(transaction.accountId, moneyAccount.id))
      .leftJoin(creditLine, eq(transaction.creditLineId, creditLine.id))
      .where(and(eq(transaction.userId, user.id), gte(transaction.date, monthStart(now, -2))))
      .orderBy(desc(transaction.date), desc(transaction.createdAt))
      .limit(100),
  ]);

  const opt = (kind: "expense" | "income") => cats.filter((c) => c.kind === kind).map((c) => ({ id: c.id, label: `${c.emoji} ${c.name}` }));
  const monthExpenses = txns.filter((r) => r.t.kind === "expense" && r.t.date >= monthFrom);
  const spent = monthExpenses.reduce((s, r) => s + r.t.amountCents, 0);
  const byCat = new Map<string, { label: string; cents: number }>();
  for (const r of monthExpenses) {
    const key = r.catName ?? "Sin categoría";
    const prev = byCat.get(key) ?? { label: `${r.catEmoji ?? "•"} ${key}`, cents: 0 };
    prev.cents += r.t.amountCents;
    byCat.set(key, prev);
  }
  const topCats = [...byCat.values()].sort((a, b) => b.cents - a.cents).slice(0, 5);
  const defaultAccount = accounts.find((a) => a.isDefault) ?? accounts[0];

  return (
    <div>
      <PageHeader eyebrow="Movimientos" title="Lo que entra. Lo que sale.">
        Registra gastos con débito, efectivo o tarjeta, e ingresos extra. Con tarjeta de crédito, el gasto se suma a su ciclo.
      </PageHeader>

      <div className="mt-12 grid gap-4 md:grid-cols-5">
        <GlassCard interactive={false} className="rise d2 p-6 md:col-span-3 md:p-8">
          {accounts.length || lines.length ? (
            <TxnForm
              categories={{ expense: opt("expense"), income: opt("income") }}
              accounts={accounts.map((a) => ({ id: a.id, label: a.name }))}
              lines={lines.map((l) => ({ id: l.id, label: l.name }))}
              today={now}
              defaultSource={defaultAccount ? `a:${defaultAccount.id}` : `c:${lines[0]?.id ?? ""}`}
            />
          ) : (
            <EmptyState title="Primero agrega una cuenta o tarjeta">Así sabremos de dónde sale cada gasto.</EmptyState>
          )}
        </GlassCard>

        <GlassCard as="article" className="rise d3 p-6 md:col-span-2 md:p-8">
          <p className="eyebrow">Este mes</p>
          <p className="num mt-4 text-[38px] font-semibold leading-none tracking-tighter chrome">{formatMXN(spent, { round: true })}</p>
          <p className="mt-2 text-[13px] text-mist">en gastos registrados</p>
          {topCats.length ? (
            <ul className="mt-6 grid gap-3 text-[13px]">
              {topCats.map((c) => (
                <li key={c.label}>
                  <div className="flex justify-between gap-3">
                    <span className="truncate text-mist">{c.label}</span>
                    <span className="num">{formatMXN(c.cents, { round: true })}</span>
                  </div>
                  <div className="mt-1.5 h-1 rounded-full bg-white/[.06]">
                    <div className="h-full rounded-full bg-glow/70" style={{ width: `${Math.max(4, (c.cents / spent) * 100)}%` }} />
                  </div>
                </li>
              ))}
            </ul>
          ) : null}
        </GlassCard>
      </div>

      <section className="mt-12">
        <h2 className="eyebrow">Últimos movimientos</h2>
        {txns.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Sin movimientos todavía">El primero que registres aparecerá aquí.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2">
            {txns.map(({ t, catName, catEmoji, accName, lineName, lineColor }) => {
              const incoming = t.kind === "income";
              return (
                <li key={t.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-[16px]" aria-hidden="true">
                    {t.kind === "card_payment" ? "↗" : (catEmoji ?? "•")}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{t.merchant ?? t.note ?? catName ?? KIND_LABEL[t.kind]}</p>
                    <p className="mt-0.5 truncate text-[12px] text-haze">
                      {fmtDay(t.date)} · {catName ?? KIND_LABEL[t.kind]} ·{" "}
                      {lineName ? (
                        <span>
                          <span className="mr-1 inline-block h-1.5 w-1.5 rounded-full align-middle" style={{ background: lineColor ?? undefined }} />
                          {lineName}
                        </span>
                      ) : (
                        (accName ?? "Sin cuenta")
                      )}
                    </p>
                  </div>
                  <span className={`num shrink-0 text-[15px] ${incoming ? "text-mint" : ""}`}>
                    {incoming ? "+" : "−"}
                    {formatMXN(t.amountCents)}
                  </span>
                  {t.kind === "expense" || t.kind === "income" ? (
                    <ActionButton action={deleteTxnAction} fields={{ id: t.id }} className="!px-3" pending="…">
                      <span aria-label="Borrar">✕</span>
                    </ActionButton>
                  ) : null}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
