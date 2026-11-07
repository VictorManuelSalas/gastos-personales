import { formatMXN, parseMoney } from "@gp/core";
import { creditLine, db } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtDay, fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { simulatePurchase } from "@/server/finance/simulate";

export const metadata: Metadata = { title: "¿Me alcanza?" };

const VERDICT = {
  good: "bg-mint/10 text-mint ring-mint/25",
  warn: "bg-amber/10 text-amber ring-amber/25",
  bad: "bg-rose/10 text-rose ring-rose/25",
} as const;

type Props = { searchParams: Promise<{ producto?: string; precio?: string; meses?: string; tarjeta?: string }> };

export default async function SimulatorPage({ searchParams }: Props) {
  const { user } = await requireUser();
  const q = await searchParams;
  const lines = await db
    .select()
    .from(creditLine)
    .where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card")))
    .orderBy(creditLine.name);

  const price = parseMoney(q.precio ?? "");
  const months = Number(q.meses);
  const ready = price && price > 0 && Number.isInteger(months) && months >= 1 && months <= 48 && q.tarjeta;
  const sim = ready ? await simulatePurchase(user.id, { lineId: q.tarjeta!, product: q.producto?.trim() || "Compra", priceCents: price, months }) : null;

  return (
    <div>
      <PageHeader eyebrow="Simulador" title="¿Me alcanza?">
        Antes de comprar a meses, mira cómo quedarían tus próximas quincenas. No se guarda nada.
      </PageHeader>

      {lines.length === 0 ? (
        <div className="mt-10">
          <EmptyState title="Primero registra una tarjeta">El simulador agrega la compra al ciclo de la tarjeta que elijas.</EmptyState>
        </div>
      ) : (
        <GlassCard interactive={false} className="rise d3 mt-10 p-6 md:p-8">
          <form method="get" className="grid gap-4 sm:grid-cols-[1.2fr_1fr_110px_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="sm-product" className="block text-[12px] text-haze">
                ¿Qué quieres comprar?
              </label>
              <input id="sm-product" name="producto" defaultValue={q.producto ?? ""} placeholder="Celular" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="sm-price" className="block text-[12px] text-haze">
                Precio
              </label>
              <input id="sm-price" name="precio" inputMode="decimal" defaultValue={q.precio ?? ""} placeholder="9000" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="sm-months" className="block text-[12px] text-haze">
                Meses
              </label>
              <select id="sm-months" name="meses" defaultValue={q.meses ?? "12"} className="field mt-1.5">
                {[1, 3, 6, 9, 12, 18, 24].map((m) => (
                  <option key={m} value={m}>
                    {m === 1 ? "Contado" : `${m} MSI`}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="sm-card" className="block text-[12px] text-haze">
                Tarjeta
              </label>
              <select id="sm-card" name="tarjeta" defaultValue={q.tarjeta ?? lines[0]!.id} className="field mt-1.5">
                {lines.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.name}
                  </option>
                ))}
              </select>
            </div>
            <button type="submit" className="btn btn-primary rounded-xl px-5 py-3 text-[14px]">
              Simular
            </button>
          </form>
        </GlassCard>
      )}

      {q.precio && !ready ? <p className="mt-4 text-[14px] text-rose">Revisa el precio y los meses.</p> : null}

      {sim ? (
        <section className="mt-10">
          <p className={`rounded-2xl px-5 py-4 text-[16px] ring-1 ${VERDICT[sim.verdict.level]}`}>{sim.verdict.text}</p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <GlassCard as="article" className="p-6">
              <p className="eyebrow">{sim.months === 1 ? "Pago" : "Mensualidad"}</p>
              <p className="num mt-3 text-[32px] font-semibold leading-none tracking-tighter">{formatMXN(sim.monthlyCents)}</p>
              <p className="mt-2 text-[13px] text-mist">
                {sim.firstDue ? `Primer cargo: límite ${fmtDay(sim.firstDue)}, quincena del ${fmtShort(sim.firstPayday!)}` : `En ${sim.line.name}`}
              </p>
            </GlassCard>
            <GlassCard as="article" className="p-6">
              <p className="eyebrow">Cuotas MSI / ingreso</p>
              <p className="num mt-3 text-[32px] font-semibold leading-none tracking-tighter">
                {sim.msiPctBefore ?? "—"}% → <span className={(sim.msiPctAfter ?? 0) > 20 ? "text-rose" : (sim.msiPctAfter ?? 0) > 10 ? "text-amber" : "text-mint"}>{sim.msiPctAfter ?? "—"}%</span>
              </p>
              <p className="mt-2 text-[13px] text-mist">{sim.hasIncome ? "Sano: menos de 10%. Riesgo: más de 20%." : "Agrega tus ingresos para calcularlo."}</p>
            </GlassCard>
            <GlassCard as="article" className="p-6">
              <p className="eyebrow">Quincena más apretada</p>
              <p className="num mt-3 text-[32px] font-semibold leading-none tracking-tighter">
                <span className={sim.minAfter < 0 ? "text-rose" : ""}>{formatMXN(sim.minAfter, { round: true })}</span>
              </p>
              <p className="num mt-2 text-[13px] text-mist">Sin la compra: {formatMXN(sim.minBefore, { round: true })}</p>
            </GlassCard>
          </div>

          <GlassCard interactive={false} className="mt-4 overflow-x-auto p-6">
            <h2 className="text-lg font-semibold tracking-tight">Tus próximas quincenas</h2>
            <table className="num mt-4 w-full min-w-[420px] text-[14px]">
              <thead>
                <tr className="text-left text-[12px] text-haze">
                  <th className="pb-2 font-normal">Cobro</th>
                  <th className="pb-2 text-right font-normal">Sin la compra</th>
                  <th className="pb-2 text-right font-normal">Con la compra</th>
                  <th className="pb-2 text-right font-normal">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {sim.rows.map((r) => (
                  <tr key={r.payday} className="border-t border-white/[.06]">
                    <td className="py-2.5 text-mist">{fmtShort(r.payday)}</td>
                    <td className="py-2.5 text-right">{formatMXN(r.before, { round: true })}</td>
                    <td className={`py-2.5 text-right ${r.after < 0 ? "text-rose" : ""}`}>{formatMXN(r.after, { round: true })}</td>
                    <td className="py-2.5 text-right text-haze">{r.after - r.before === 0 ? "—" : formatMXN(r.after - r.before, { round: true })}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-4 text-[12px] text-haze">El saldo de cada quincena incluye lo de las anteriores, así que la diferencia se va acumulando.</p>
          </GlassCard>
        </section>
      ) : null}
    </div>
  );
}
