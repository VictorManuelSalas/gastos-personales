import { formatMXN, today } from "@gp/core";
import { category, db, transaction } from "@gp/db";
import { and, eq, gte, lt } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList, TrendBars } from "@/components/charts/charts";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Reporte anual" };

const MONTHS = ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"];

export default async function YearReportPage({ searchParams }: { searchParams: Promise<{ anio?: string }> }) {
  const { user } = await requireUser();
  const now = today();
  const { anio } = await searchParams;
  const year = anio && /^\d{4}$/.test(anio) && Number(anio) <= Number(now.slice(0, 4)) ? Number(anio) : Number(now.slice(0, 4));
  const from = `${year}-01-01`;
  const to = `${year + 1}-01-01`;

  const rows = await db
    .select({ kind: transaction.kind, amount: transaction.amountCents, date: transaction.date, accountId: transaction.accountId, cat: category.name, emoji: category.emoji })
    .from(transaction)
    .leftJoin(category, eq(transaction.categoryId, category.id))
    .where(and(eq(transaction.userId, user.id), gte(transaction.date, from), lt(transaction.date, to)));

  const months = MONTHS.map((label, i) => {
    const m = `${year}-${String(i + 1).padStart(2, "0")}`;
    const inMonth = rows.filter((r) => r.date.startsWith(m));
    const income = inMonth.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
    // Salidas reales: gastos con cuenta + pagos de tarjeta (los gastos con tarjeta ya van en el pago).
    const out = inMonth.filter((r) => r.kind === "card_payment" || (r.kind === "expense" && r.accountId)).reduce((s, r) => s + r.amount, 0);
    const spent = inMonth.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
    return { label, month: `${m}-01`, income, out, spent };
  });
  const totalIncome = months.reduce((s, m) => s + m.income, 0);
  const totalOut = months.reduce((s, m) => s + m.out, 0);
  const totalSpent = months.reduce((s, m) => s + m.spent, 0);
  const byCat = new Map<string, number>();
  for (const r of rows.filter((x) => x.kind === "expense")) {
    const k = r.cat ? `${r.emoji} ${r.cat}` : "• Sin categoría";
    byCat.set(k, (byCat.get(k) ?? 0) + r.amount);
  }
  const cats = [...byCat.entries()].map(([label, cents]) => ({ key: label, label, cents })).sort((a, b) => b.cents - a.cents).slice(0, 10);
  const rate = totalIncome > 0 ? Math.round(((totalIncome - totalOut) / totalIncome) * 100) : null;

  return (
    <div>
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow rise">Reporte anual</p>
          <h1 className="num rise d1 mt-5 text-[clamp(2.8rem,8vw,5.6rem)] font-semibold leading-[0.92] tracking-tighter chrome">{year}</h1>
        </div>
        <nav className="flex gap-2" aria-label="Cambiar año">
          <Link href={`/app/reporte?anio=${year - 1}`} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
            ← {year - 1}
          </Link>
          {year < Number(now.slice(0, 4)) ? (
            <Link href={`/app/reporte?anio=${year + 1}`} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
              {year + 1} →
            </Link>
          ) : null}
        </nav>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-4">
        {[
          ["Ingresos registrados", formatMXN(totalIncome, { round: true })],
          ["Salidas de dinero", formatMXN(totalOut, { round: true })],
          ["Gastos registrados", formatMXN(totalSpent, { round: true })],
          ["Tasa de ahorro", rate == null ? "—" : `${rate}%`],
        ].map(([k, v]) => (
          <GlassCard as="article" key={k} className="p-5">
            <p className="text-[13px] text-mist">{k}</p>
            <p className="num mt-3 text-[26px] font-semibold leading-none tracking-tight">{v}</p>
          </GlassCard>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <GlassCard interactive={false} className="p-6 lg:col-span-3">
          <h2 className="text-lg font-semibold tracking-tight">Gasto registrado por mes</h2>
          <div className="mt-6">
            <TrendBars data={months.map((m) => ({ month: m.month, cents: m.spent }))} labels={months.map((m) => m.label)} />
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Top 10 categorías</h2>
          <div className="mt-6">{cats.length ? <BarList items={cats} total={totalSpent} /> : <p className="text-[13px] text-haze">Sin gastos este año.</p>}</div>
        </GlassCard>
      </div>

      <GlassCard interactive={false} className="mt-4 overflow-x-auto p-6">
        <h2 className="text-lg font-semibold tracking-tight">Mes por mes</h2>
        <table className="num mt-4 w-full min-w-[480px] text-[14px]">
          <thead>
            <tr className="text-left text-[12px] text-haze">
              <th className="pb-2 font-normal">Mes</th>
              <th className="pb-2 text-right font-normal">Ingresos</th>
              <th className="pb-2 text-right font-normal">Salidas</th>
              <th className="pb-2 text-right font-normal">Diferencia</th>
            </tr>
          </thead>
          <tbody>
            {months.map((m) => (
              <tr key={m.label} className="border-t border-white/[.06]">
                <td className="py-2.5 capitalize text-mist">{m.label}</td>
                <td className="py-2.5 text-right">{formatMXN(m.income, { round: true })}</td>
                <td className="py-2.5 text-right">{formatMXN(m.out, { round: true })}</td>
                <td className={`py-2.5 text-right ${m.income - m.out < 0 ? "text-rose" : "text-mint"}`}>{formatMXN(m.income - m.out, { round: true })}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="mt-4 text-[12px] text-haze">Salidas = gastos con débito o efectivo + pagos de tarjeta. Los gastos con tarjeta cuentan cuando pagas la tarjeta, para no contarlos dos veces.</p>
      </GlassCard>

      <div className="mt-6">
        <a href="/api/export" className="btn btn-ghost rounded-full px-5 py-2.5 text-[14px]">
          Descargar todo en Excel
        </a>
      </div>
    </div>
  );
}
