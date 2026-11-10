import { formatMXN } from "@gp/core";
import type { Metadata } from "next";
import { HELP } from "@/lib/help";
import Link from "next/link";
import { LineForm } from "@/components/finance/line-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtDay, fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { createLineAction } from "@/server/actions/cards";
import { cardSummaries, loadFinance } from "@/server/finance/overview";

export const metadata: Metadata = { title: "Tarjetas" };

export default async function CardsPage() {
  const { user } = await requireUser();
  const f = await loadFinance(user.id);
  const cards = cardSummaries(f);

  return (
    <div>
      <PageHeader eyebrow="Tarjetas y préstamos" help={HELP.tarjetas} title="Cada corte, en su lugar.">
        Registra cada tarjeta una vez. Los ciclos, las fechas límite y la quincena que los paga se calculan solos.
      </PageHeader>

      <Disclosure label="Agregar tarjeta o préstamo" variant="primary" className="rise d3 mt-10" defaultOpen={cards.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <LineForm action={createLineAction} submitLabel="Guardar" />
        </GlassCard>
      </Disclosure>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {cards.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="Aún no tienes tarjetas">Empieza con la que más usas. Solo necesitas el día de corte y la regla de la fecha límite.</EmptyState>
          </div>
        ) : null}
        {cards.map(({ line, open, nextPayment, msi }) => {
          const used = line.creditLimitCents ? Math.min(100, Math.round((open.amountCents / line.creditLimitCents) * 100)) : null;
          return (
            <Link key={line.id} href={`/app/tarjetas/${line.id}`} className="block">
              <GlassCard as="article" className="h-full p-6">
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ background: line.color }} />
                  <h2 className="truncate text-lg font-semibold tracking-tight">{line.name}</h2>
                  <span className="ml-auto rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-haze">
                    {line.kind === "loan" ? "Préstamo" : `Corte día ${line.cutDay}`}
                  </span>
                </div>

                {nextPayment ? (
                  <div className="mt-6">
                    <p className="eyebrow">{nextPayment.status === "overdue" ? "Pago vencido" : "Próximo pago"}</p>
                    <p className={`num mt-2 text-[34px] font-semibold leading-none tracking-tighter ${nextPayment.status === "overdue" ? "text-rose" : ""}`}>
                      {formatMXN(nextPayment.amountCents)}
                    </p>
                    <p className="mt-2 text-[13px] text-mist">
                      Límite {fmtDay(nextPayment.due)} · quincena del {fmtShort(nextPayment.payday)}
                    </p>
                  </div>
                ) : (
                  <div className="mt-6">
                    <p className="eyebrow">Próximo pago</p>
                    <p className="mt-2 text-[15px] text-mist">Nada pendiente por ahora.</p>
                  </div>
                )}

                {line.kind === "loan" ? (
                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4 text-[12px]">
                    <div>
                      <p className="text-haze">Mensualidad</p>
                      <p className="num mt-1 text-mist">{formatMXN(line.fixedPaymentCents ?? 0)}</p>
                    </div>
                    <div>
                      <p className="text-haze">Restantes</p>
                      <p className="num mt-1 text-mist">{line.remainingPayments ?? "Sin capturar"}</p>
                    </div>
                  </div>
                ) : (
                  <div className="mt-6 grid grid-cols-2 gap-3 border-t border-white/[.06] pt-4 text-[12px]">
                    <div>
                      <p className="text-haze">Ciclo actual</p>
                      <p className="mt-1 text-mist">
                        {fmtShort(open.start)} – {fmtShort(open.cut)}
                      </p>
                    </div>
                    <div>
                      <p className="text-haze">{used != null ? "Uso del límite" : msi.length ? "MSI activos" : "Registrado en el ciclo"}</p>
                      <p className="num mt-1 text-mist">
                        {used != null ? `${used}%` : msi.length ? msi.length : formatMXN(open.spentCents, { round: true })}
                      </p>
                    </div>
                  </div>
                )}
              </GlassCard>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
