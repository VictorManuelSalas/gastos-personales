import { centsToInput, formatMXN } from "@gp/core";
import { creditLine, db, moneyAccount } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { TrendBars } from "@/components/charts/charts";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUser } from "@/lib/session";
import { addClientAction, addCostAction, archiveProjectAction, chargeClientAction, toggleClientAction, updateInvestmentAction } from "@/server/actions/projects";
import { projectSummary } from "@/server/finance/projects";

export const metadata: Metadata = { title: "Proyecto" };

const monthLabel = (iso: string) => new Intl.DateTimeFormat("es-MX", { month: "short", timeZone: "UTC" }).format(new Date(`${iso}T12:00:00Z`)).replace(".", "");

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const s = await projectSummary(user.id, id);
  if (!s) notFound();
  const [accounts, lines] = await Promise.all([
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))),
    db.select().from(creditLine).where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
  ]);
  const recoveredPct = s.project.investmentCents > 0 ? Math.min(100, Math.round((s.recoveredCents / s.project.investmentCents) * 100)) : 100;

  return (
    <div>
      <Link href="/app/proyectos" className="text-[13px] text-haze transition-colors hover:text-ink">
        ← Proyectos
      </Link>
      <section className="mt-6">
        <p className="eyebrow rise">Proyecto</p>
        <h1 className="rise d1 mt-4 text-[clamp(2.6rem,7vw,4.6rem)] font-semibold leading-[0.95] tracking-tighter chrome">{s.project.name}</h1>
      </section>

      <div className="mt-10 grid gap-4 sm:grid-cols-3">
        <GlassCard as="article" className="p-5">
          <p className="text-[13px] text-mist">Ganancia promedio</p>
          <p className={`num mt-3 text-[28px] font-semibold leading-none tracking-tight ${s.avgProfitCents < 0 ? "text-rose" : ""}`}>{formatMXN(s.avgProfitCents, { round: true })}</p>
          <p className="mt-1 text-[12px] text-haze">al mes, con lo registrado</p>
        </GlassCard>
        <GlassCard as="article" className="p-5">
          <p className="text-[13px] text-mist">Cobro esperado</p>
          <p className="num mt-3 text-[28px] font-semibold leading-none tracking-tight">{formatMXN(s.expectedMonthlyCents, { round: true })}</p>
          <p className="mt-1 text-[12px] text-haze">al mes con los clientes activos</p>
        </GlassCard>
        <GlassCard as="article" className="p-5">
          <p className="text-[13px] text-mist">Inversión recuperada</p>
          <p className="num mt-3 text-[28px] font-semibold leading-none tracking-tight">{recoveredPct}%</p>
          <p className="mt-1 text-[12px] text-haze">
            {formatMXN(s.recoveredCents, { round: true })} de {formatMXN(s.project.investmentCents, { round: true })}
            {s.paybackMonths ? ` · ~${s.paybackMonths} meses en total` : ""}
          </p>
        </GlassCard>
      </div>

      <GlassCard interactive={false} className="mt-4 p-6">
        <h2 className="text-lg font-semibold tracking-tight">Ganancia por mes</h2>
        <p className="mt-1 text-[13px] text-haze">Cobros menos costos de cada mes (los meses con pérdida aparecen en cero).</p>
        <div className="mt-6">
          <TrendBars data={s.months.map((m) => ({ month: m.month, cents: Math.max(0, m.profit) }))} labels={s.months.map((m) => monthLabel(m.month))} />
        </div>
      </GlassCard>

      <section className="mt-10">
        <h2 className="eyebrow">Clientes</h2>
        <ul className="mt-4 grid gap-2">
          {s.clients.map((c) => (
            <li key={c.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06] ${c.active ? "" : "opacity-50"}`}>
              <span className="min-w-0 flex-1 text-[14px]">{c.name}</span>
              <span className="num text-[14px]">{formatMXN(c.monthlyCents)}</span>
              {c.active ? (
                c.chargedThisMonth ? (
                  <span className="text-[12px] text-mint">Cobrado este mes</span>
                ) : (
                  <ActionButton action={chargeClientAction} fields={{ projectId: s.project.id, clientId: c.id }} variant="primary">
                    Cobrar mes
                  </ActionButton>
                )
              ) : null}
              <ActionButton action={toggleClientAction} fields={{ projectId: s.project.id, clientId: c.id, active: String(!c.active) }} className="!px-3">
                {c.active ? "Pausar" : "Reactivar"}
              </ActionButton>
            </li>
          ))}
        </ul>
        <GlassCard interactive={false} className="mt-3 p-5">
          <ActionForm action={addClientAction} className="grid gap-3 sm:grid-cols-[1fr_160px_auto] sm:items-end">
            <input type="hidden" name="projectId" value={s.project.id} />
            <div>
              <label htmlFor="cl-name" className="block text-[12px] text-haze">
                Cliente
              </label>
              <input id="cl-name" name="name" placeholder="Nombre" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="cl-monthly" className="block text-[12px] text-haze">
                Cobro mensual
              </label>
              <input id="cl-monthly" name="monthly" inputMode="decimal" placeholder="350" className="field num mt-1.5" />
            </div>
            <SubmitButton>Agregar cliente</SubmitButton>
          </ActionForm>
        </GlassCard>
      </section>

      <section className="mt-10 flex flex-wrap gap-3">
        <Disclosure label="Registrar costo" className="w-full">
          <GlassCard interactive={false} className="p-5">
            <ActionForm action={addCostAction} closeOnOk className="grid gap-3 sm:grid-cols-[1fr_140px_1fr_auto] sm:items-end">
              <input type="hidden" name="projectId" value={s.project.id} />
              <input name="concept" placeholder="Renta del servicio, antena…" aria-label="Concepto" className="field" />
              <input name="amount" inputMode="decimal" placeholder="1100" aria-label="Monto" className="field num" />
              <select name="source" defaultValue={accounts[0] ? `a:${accounts[0].id}` : ""} aria-label="Pagado con" className="field">
                <option value="">Sin cuenta</option>
                {accounts.map((a) => (
                  <option key={a.id} value={`a:${a.id}`}>
                    {a.name}
                  </option>
                ))}
                {lines.map((l) => (
                  <option key={l.id} value={`c:${l.id}`}>
                    Tarjeta {l.name}
                  </option>
                ))}
              </select>
              <SubmitButton>Registrar</SubmitButton>
            </ActionForm>
            <p className="mt-2 text-[12px] text-haze">También puedes mandarlo al bot con la etiqueta: <span className="font-mono">antena 1450 #{s.project.name.toLowerCase().replace(/\s+/g, "-")}</span></p>
          </GlassCard>
        </Disclosure>
        <Disclosure label="Cambiar inversión" className="w-full">
          <GlassCard interactive={false} className="p-5">
            <ActionForm action={updateInvestmentAction} resetOnOk={false} closeOnOk className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="projectId" value={s.project.id} />
              <input name="investment" inputMode="decimal" defaultValue={centsToInput(s.project.investmentCents)} aria-label="Inversión total" className="field num" />
              <SubmitButton>Guardar</SubmitButton>
            </ActionForm>
          </GlassCard>
        </Disclosure>
      </section>

      <section className="mt-12 flex flex-wrap items-center gap-4">
        <ActionButton action={archiveProjectAction} fields={{ id: s.project.id }} variant="danger" pending="Archivando…">
          Archivar proyecto
        </ActionButton>
        <p className="min-w-0 flex-1 text-[12px] text-haze">Lo quita de la lista. Sus cobros y costos se quedan en Movimientos y en el saldo de tus cuentas.</p>
      </section>
    </div>
  );
}
