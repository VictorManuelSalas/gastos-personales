import { budgetStatus, formatMXN, monthStart, today, type Level } from "@gp/core";
import { category, db } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { BarList, ClassSplit, TrendBars } from "@/components/charts/charts";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUser } from "@/lib/session";
import { deleteBudgetAction, setBudgetAction } from "@/server/actions/budgets";
import { monthAnalytics } from "@/server/finance/analytics";
import { computeHealth } from "@/server/finance/health";
import { loadFinance } from "@/server/finance/overview";

export const metadata: Metadata = { title: "Análisis" };

const LEVEL: Record<Level, { label: string; dot: string; text: string }> = {
  good: { label: "Bien", dot: "bg-mint", text: "text-mint" },
  warn: { label: "Atención", dot: "bg-amber", text: "text-amber" },
  bad: { label: "Riesgo", dot: "bg-rose", text: "text-rose" },
};

const monthName = (iso: string, opts: Intl.DateTimeFormatOptions = { month: "long", year: "numeric" }) =>
  new Intl.DateTimeFormat("es-MX", { ...opts, timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`));

type Props = { searchParams: Promise<{ mes?: string }> };

export default async function AnalysisPage({ searchParams }: Props) {
  const { user } = await requireUser();
  const { mes } = await searchParams;
  const now = today();
  const month = mes && /^\d{4}-\d{2}$/.test(mes) && `${mes}-01` <= now ? `${mes}-01` : monthStart(now);
  const prevMonth = monthStart(month, -1);
  const nextMonth = monthStart(month, 1);

  const [a, prev, f, cats] = await Promise.all([
    monthAnalytics(user.id, month),
    monthAnalytics(user.id, prevMonth),
    loadFinance(user.id),
    db.select().from(category).where(and(eq(category.userId, user.id), eq(category.kind, "expense"), isNull(category.archivedAt))).orderBy(category.sortOrder),
  ]);
  const health = await computeHealth(user.id, f);
  const delta = prev.total > 0 ? Math.round(((a.total - prev.total) / prev.total) * 100) : null;
  const topCats = a.byCategory.slice(0, 8);
  const rest = a.byCategory.slice(8).reduce((s, c) => s + c.cents, 0);

  return (
    <div>
      <section className="flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow rise first-letter:uppercase">{monthName(month)}</p>
          <h1 className="num rise d1 mt-5 text-[clamp(2.8rem,8vw,5.6rem)] font-semibold leading-[0.92] tracking-tighter chrome">{formatMXN(a.total, { round: true })}</h1>
          <p className="rise d2 mt-4 text-[15px] text-mist">
            gastados en {a.count} movimientos
            {delta != null ? (
              <>
                {" · "}
                <span className={delta > 0 ? "text-amber" : "text-mint"}>
                  {delta > 0 ? "+" : ""}
                  {delta}% vs {monthName(prevMonth, { month: "long" })}
                </span>
              </>
            ) : null}
            {a.antCents ? ` · ${formatMXN(a.antCents, { round: true })} en antojos` : ""}
          </p>
        </div>
        <nav className="rise d2 flex gap-2" aria-label="Cambiar mes">
          <Link href={`/app/analisis?mes=${prevMonth.slice(0, 7)}`} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
            ← {monthName(prevMonth, { month: "short" })}
          </Link>
          {nextMonth <= now ? (
            <Link href={`/app/analisis?mes=${nextMonth.slice(0, 7)}`} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
              {monthName(nextMonth, { month: "short" })} →
            </Link>
          ) : null}
        </nav>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Salud financiera</h2>
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {health.indicators.map((i) => (
            <GlassCard as="article" key={i.key} className="p-5">
              <div className="flex items-center justify-between gap-2">
                <p className="text-[13px] text-mist">{i.label}</p>
                {i.level ? (
                  <span className={`flex items-center gap-1.5 text-[11px] ${LEVEL[i.level].text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${LEVEL[i.level].dot}`} aria-hidden="true" />
                    {LEVEL[i.level].label}
                  </span>
                ) : (
                  <span className="text-[11px] text-haze">Sin datos</span>
                )}
              </div>
              <p className="num mt-3 text-[28px] font-semibold leading-none tracking-tight">
                {i.value == null ? "—" : `${i.value}${i.unit === "%" ? "%" : ` ${i.value === 1 ? "mes" : "meses"}`}`}
              </p>
              <p className="mt-2 text-[12px] leading-relaxed text-haze">{i.help}</p>
            </GlassCard>
          ))}
        </div>
        {health.income === 0 ? <p className="mt-3 text-[13px] text-haze">Agrega tus ingresos para calcular los porcentajes.</p> : null}
      </section>

      <div className="mt-12 grid gap-4 lg:grid-cols-5">
        <GlassCard interactive={false} className="p-6 lg:col-span-3">
          <h2 className="text-lg font-semibold tracking-tight">Gasto de los últimos 6 meses</h2>
          <p className="mt-1 text-[13px] text-haze">Gastos registrados (con tarjeta, débito o efectivo).</p>
          <div className="mt-6">
            <TrendBars data={a.trend} labels={a.trend.map((t) => monthName(t.month, { month: "short" }).replace(".", ""))} />
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-6 lg:col-span-2">
          <h2 className="text-lg font-semibold tracking-tight">Regla 50/30/20</h2>
          <p className="mt-1 text-[13px] text-haze">Referencia: 50% esencial, 30% estilo de vida, 20% ahorro y deuda.</p>
          <div className="mt-6">
            <ClassSplit data={a.byClass} />
          </div>
        </GlassCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Por categoría</h2>
          <div className="mt-6">
            {topCats.length ? (
              <BarList
                total={a.total}
                items={[...topCats.map((c) => ({ key: c.key, label: `${c.emoji} ${c.label}`, cents: c.cents })), ...(rest ? [{ key: "rest", label: "Otras", cents: rest }] : [])]}
              />
            ) : (
              <p className="text-[13px] text-haze">Sin gastos este mes.</p>
            )}
          </div>
        </GlassCard>

        <GlassCard interactive={false} className="p-6">
          <div className="flex items-center justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight">Presupuestos</h2>
          </div>
          {a.budgets.length ? (
            <ul className="mt-6 grid gap-4">
              {a.budgets.map((b) => {
                const st = budgetStatus(b.spent, b.limit);
                return (
                  <li key={b.id}>
                    <div className="flex items-baseline justify-between gap-3 text-[13px]">
                      <span className="min-w-0 truncate text-mist">{b.label}</span>
                      <span className="num shrink-0">
                        {formatMXN(b.spent, { round: true })} <span className="text-haze">/ {formatMXN(b.limit, { round: true })}</span>
                      </span>
                    </div>
                    <div className="mt-1.5 h-2 rounded-full bg-white/[.05]">
                      <div className={`h-full rounded-full ${LEVEL[st.level].dot}`} style={{ width: `${Math.min(100, st.pct)}%`, opacity: 0.85 }} />
                    </div>
                    <div className="mt-1 flex items-center justify-between text-[11px]">
                      <span className={LEVEL[st.level].text}>
                        {st.level === "good" ? `Vas bien · ${st.pct}%` : st.level === "warn" ? `Cerca del tope · ${st.pct}%` : `Te pasaste · ${st.pct}%`}
                      </span>
                      <ActionButton action={deleteBudgetAction} fields={{ id: b.id }} className="!px-2 !py-0.5 !text-[11px]">
                        Quitar
                      </ActionButton>
                    </div>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="mt-4 text-[13px] text-haze">Pon un tope mensual a las categorías donde quieras gastar menos. Te avisamos al 80% y al 100%.</p>
          )}
          <Disclosure label="Agregar presupuesto" className="mt-5">
            <ActionForm action={setBudgetAction} closeOnOk className="grid gap-3 sm:grid-cols-[1fr_120px_auto] sm:items-end">
              <div>
                <label htmlFor="bg-target" className="block text-[12px] text-haze">
                  Categoría
                </label>
                <select id="bg-target" name="target" defaultValue="" className="field mt-1.5">
                  <option value="" disabled>
                    Elige
                  </option>
                  <optgroup label="Por clase">
                    <option value="class:essential">Esenciales (50)</option>
                    <option value="class:lifestyle">Estilo de vida (30)</option>
                  </optgroup>
                  <optgroup label="Por categoría">
                    {cats.map((c) => (
                      <option key={c.id} value={c.id}>{`${c.emoji} ${c.name}`}</option>
                    ))}
                  </optgroup>
                </select>
              </div>
              <div>
                <label htmlFor="bg-amount" className="block text-[12px] text-haze">
                  Tope al mes
                </label>
                <input id="bg-amount" name="amount" inputMode="decimal" placeholder="800" className="field num mt-1.5" />
              </div>
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </Disclosure>
        </GlassCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Por tarjeta o cuenta</h2>
          <div className="mt-6">
            {a.bySource.length ? <BarList total={a.total} items={a.bySource.map((s) => ({ key: s.key, label: s.key, cents: s.cents }))} /> : <p className="text-[13px] text-haze">Sin datos.</p>}
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Dónde gastas más</h2>
          <div className="mt-6">
            {a.byMerchant.length ? <BarList total={a.total} items={a.byMerchant.map((s) => ({ key: s.key, label: s.key, cents: s.cents }))} /> : <p className="text-[13px] text-haze">Escribe el comercio al registrar para verlo aquí.</p>}
          </div>
        </GlassCard>
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Etiquetas</h2>
          <div className="mt-6">
            {a.byTag.length ? <BarList total={a.total} items={a.byTag.map((s) => ({ key: s.key, label: `#${s.key}`, cents: s.cents }))} /> : <p className="text-[13px] text-haze">Usa etiquetas como #viaje para ver totales que cruzan categorías.</p>}
          </div>
        </GlassCard>
      </div>
    </div>
  );
}
