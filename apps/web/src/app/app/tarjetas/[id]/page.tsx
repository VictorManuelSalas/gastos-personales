import {
  addDays,
  assignPayday,
  centsToInput,
  cycleContaining,
  cyclesWithCutBetween,
  formatMXN,
  monthStart,
  paydayAfter,
  paydayOnOrBefore,
} from "@gp/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CycleCard, type CycleProps } from "@/components/finance/cycle-card";
import { LineForm } from "@/components/finance/line-form";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtDay, fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { archiveLineAction, createInstallmentAction, deleteInstallmentAction, updateLineAction } from "@/server/actions/cards";
import { cardSummaries, loadFinance, ruleOf, type CycleView } from "@/server/finance/overview";

export const metadata: Metadata = { title: "Tarjeta" };

const SOURCE: Record<CycleView["source"], string> = {
  statement: "Estado de cuenta",
  calculated: "Calculado con lo registrado",
  estimate: "Estimado",
  fixed: "Mensualidad fija",
};

export default async function CardPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const f = await loadFinance(user.id);
  const line = f.lines.find((l) => l.id === id);
  if (!line) notFound();

  const summary = cardSummaries(f).find((s) => s.line.id === id)!;
  const rule = ruleOf(line);
  const open = cycleContaining(f.now, rule);
  // Últimos 3 ciclos cortados + el abierto + el siguiente.
  const cycles = cyclesWithCutBetween(rule, monthStart(open.cut, -3), addDays(monthStart(open.cut, 2), -1))
    .filter((c) => c.cut >= line.trackingFrom)
    .map((c) => f.viewCycle(line, c))
    .reverse();

  const accounts = f.accounts.map((a) => ({ id: a.id, name: a.name, isDefault: a.isDefault }));

  const toProps = (v: CycleView): CycleProps => {
    const computed = assignPayday(f.rule, v.due);
    const prev = paydayOnOrBefore(f.rule, addDays(computed, -1));
    const next = paydayAfter(f.rule, computed);
    return {
      lineId: line.id,
      cut: v.cut,
      periodLabel: line.kind === "loan" ? `Mensualidad de ${monthName(v.due)}` : `${fmtShort(v.start)} – ${fmtShort(v.cut)}`,
      dueLabel: fmtDay(v.due),
      nonBusiness: v.nonBusiness,
      status: v.status,
      amountLabel: formatMXN(v.amountCents),
      amountInput: centsToInput(v.amountCents),
      sourceLabel:
        v.status === "paid"
          ? "Pagado"
          : v.newSpentCents
            ? `${SOURCE[v.source]} ${formatMXN(v.amountCents - v.newSpentCents)} + ${formatMXN(v.newSpentCents)} en gastos nuevos`
            : SOURCE[v.source],
      statementInput: centsToInput(v.row?.statementCents),
      minimumInput: centsToInput(v.row?.minimumCents),
      detailLabel:
        line.kind === "card" && (v.spentCents || v.msiCents)
          ? `Registrado ${formatMXN(v.spentCents)}${v.msiCents ? ` · MSI ${formatMXN(v.msiCents)}` : ""}`
          : null,
      paydayLabel: fmtShort(v.payday),
      paydayOverride: v.row?.paydayOverride ?? null,
      paydayOptions: [
        { value: "", label: `${fmtShort(computed)} (calculada)` },
        { value: prev, label: fmtShort(prev) },
        { value: next, label: fmtShort(next) },
      ],
      today: f.now,
      isLoan: line.kind === "loan",
    };
  };

  const cutOptions = cyclesWithCutBetween(rule, monthStart(open.cut, -18), monthStart(open.cut, 1)).reverse();

  return (
    <div>
      <Link href="/app/tarjetas" className="text-[13px] text-haze transition-colors hover:text-ink">
        ← Tarjetas
      </Link>
      <section className="mt-6 flex flex-wrap items-end justify-between gap-6">
        <div>
          <p className="eyebrow flex items-center gap-2 rise">
            <span className="h-2 w-2 rounded-full" style={{ background: line.color }} />
            {line.kind === "loan" ? `Préstamo · pago día ${line.cutDay}` : `Corte día ${line.cutDay} · ${line.dueKind === "days_after" ? `límite ${line.dueValue} días después` : `límite día ${line.dueValue}`}`}
          </p>
          <h1 className="rise d1 mt-4 text-[clamp(2.6rem,7vw,4.6rem)] font-semibold leading-[0.95] tracking-tighter chrome">{line.name}</h1>
        </div>
        {summary.nextPayment ? (
          <div className="rise d2 text-right">
            <p className="eyebrow">Próximo pago</p>
            <p className="num mt-2 text-[34px] font-semibold leading-none tracking-tighter">{formatMXN(summary.nextPayment.amountCents)}</p>
            <p className="mt-1.5 text-[13px] text-mist">{fmtDay(summary.nextPayment.due)}</p>
          </div>
        ) : null}
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">{line.kind === "loan" ? "Mensualidades" : "Ciclos"}</h2>
        <ul className="mt-4 grid gap-3">
          {cycles.map((v) => (
            <CycleCard key={v.cut} c={toProps(v)} accounts={accounts} />
          ))}
        </ul>
      </section>

      {line.kind === "card" ? (
        <section className="mt-12">
          <h2 className="eyebrow">Meses sin intereses</h2>
          {summary.msi.length ? (
            <ul className="mt-4 grid gap-3">
              {summary.msi.map(({ row, progress }) => (
                <GlassCard as="li" key={row.id} interactive={false} className="p-5">
                  <div className="flex flex-wrap items-center gap-4">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[15px] font-medium">{row.product}</p>
                      <p className="num mt-1 text-[12px] text-haze">
                        {formatMXN(progress.monthly)} al mes · faltan {formatMXN(progress.pendingCents)}
                      </p>
                    </div>
                    <p className="num text-[22px] font-semibold tracking-tight">
                      {progress.paid}
                      <span className="text-[14px] text-haze">/{row.months}</span>
                    </p>
                    <ActionButton action={deleteInstallmentAction} fields={{ id: row.id }} variant="danger">
                      Quitar
                    </ActionButton>
                  </div>
                  <div className="mt-4 h-1.5 rounded-full bg-white/[.06]">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#dfe4ff] to-glow" style={{ width: `${(progress.paid / row.months) * 100}%` }} />
                  </div>
                </GlassCard>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-mist">Sin compras a meses activas en esta tarjeta.</p>
          )}
          <Disclosure label="Agregar compra a MSI" className="mt-4">
            <GlassCard interactive={false} className="p-6">
              <ActionForm action={createInstallmentAction} closeOnOk className="grid gap-4 sm:grid-cols-2">
                <input type="hidden" name="lineId" value={line.id} />
                <div className="sm:col-span-2">
                  <label htmlFor="msi-product" className="block text-[12px] text-haze">
                    ¿Qué compraste?
                  </label>
                  <input id="msi-product" name="product" placeholder="Laptop Lenovo" className="field mt-1.5" />
                </div>
                <div>
                  <label htmlFor="msi-price" className="block text-[12px] text-haze">
                    Precio total
                  </label>
                  <input id="msi-price" name="price" inputMode="decimal" placeholder="5499" className="field num mt-1.5" />
                </div>
                <div>
                  <label htmlFor="msi-months" className="block text-[12px] text-haze">
                    Meses
                  </label>
                  <input id="msi-months" name="months" type="number" min={2} max={60} placeholder="12" className="field num mt-1.5" />
                </div>
                <div>
                  <label htmlFor="msi-monthly" className="block text-[12px] text-haze">
                    Mensualidad (opcional, si no es exacta)
                  </label>
                  <input id="msi-monthly" name="monthly" inputMode="decimal" className="field num mt-1.5" />
                </div>
                <div>
                  <label htmlFor="msi-first" className="block text-[12px] text-haze">
                    Primera mensualidad en el corte del
                  </label>
                  <select id="msi-first" name="firstCut" defaultValue={open.cut} className="field mt-1.5">
                    {cutOptions.map((c) => (
                      <option key={c.cut} value={c.cut}>
                        {fmtShort(c.cut)} {c.cut.slice(0, 4)}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="sm:col-span-2">
                  <SubmitButton>Agregar</SubmitButton>
                </div>
              </ActionForm>
            </GlassCard>
          </Disclosure>
        </section>
      ) : null}

      <section className="mt-12 flex flex-wrap items-start gap-3">
        <Disclosure label="Editar reglas" className="w-full">
          <GlassCard interactive={false} className="p-6 md:p-8">
            <LineForm
              action={updateLineAction}
              submitLabel="Guardar cambios"
              allowKind={false}
              defaults={{
                id: line.id,
                kind: line.kind,
                name: line.name,
                color: line.color,
                cutDay: line.cutDay,
                dueKind: line.dueKind,
                dueValue: line.dueValue,
                policy: line.businessDayPolicy,
                creditLimit: centsToInput(line.creditLimitCents),
                fixedPayment: centsToInput(line.fixedPaymentCents),
                remainingPayments: line.remainingPayments ?? "",
              }}
            />
          </GlassCard>
        </Disclosure>
        <ActionButton action={archiveLineAction} fields={{ id: line.id }} variant="danger">
          Archivar {line.kind === "loan" ? "préstamo" : "tarjeta"}
        </ActionButton>
      </section>
    </div>
  );
}

function monthName(s: string) {
  return new Intl.DateTimeFormat("es-MX", { month: "long", timeZone: "UTC" }).format(new Date(`${s}T12:00:00Z`));
}
