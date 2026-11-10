import { formatMXN } from "@gp/core";
import { db, incomeSource, moneyAccount, transaction } from "@gp/db";
import { and, desc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { HELP } from "@/lib/help";
import { IncomeSourceForm } from "@/components/finance/income-source-form";
import { ActionButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { archiveIncomeSourceAction } from "@/server/actions/money";

export const metadata: Metadata = { title: "Ingresos" };

export default async function IncomePage() {
  const { user } = await requireUser();
  const [sources, accounts, confirmed] = await Promise.all([
    db.select().from(incomeSource).where(and(eq(incomeSource.userId, user.id), eq(incomeSource.active, true))).orderBy(incomeSource.createdAt),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))),
    db
      .select()
      .from(transaction)
      .where(and(eq(transaction.userId, user.id), eq(transaction.kind, "income"), isNotNull(transaction.incomeSourceId)))
      .orderBy(desc(transaction.periodDate))
      .limit(60),
  ]);
  const perQuincena = sources.filter((s) => s.schedule === "paydays").reduce((s, x) => s + x.expectedCents, 0);

  return (
    <div>
      <PageHeader eyebrow="Ingresos" help={HELP.ingresos} title={<span className="num">{formatMXN(perQuincena)}</span>}>
        Lo que esperas recibir cada quincena. El día de cobro confirmas lo que realmente cayó (horas extra, días de más) desde tu
        quincena.
      </PageHeader>

      <Disclosure label="Agregar ingreso" variant="primary" className="rise d3 mt-10" defaultOpen={sources.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <IncomeSourceForm accounts={accounts.map((a) => ({ id: a.id, label: a.name }))} />
        </GlassCard>
      </Disclosure>

      <ul className="mt-10 grid gap-3">
        {sources.length === 0 ? <EmptyState title="Sin ingresos todavía">Agrega cada sueldo por separado para ver cuándo cae cada uno.</EmptyState> : null}
        {sources.map((s) => {
          const history = confirmed.filter((t) => t.incomeSourceId === s.id).slice(0, 6);
          const account = accounts.find((a) => a.id === s.accountId);
          return (
            <GlassCard as="li" key={s.id} interactive={false} className="p-5 md:p-6">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-[17px] font-semibold tracking-tight">{s.name}</h2>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-haze">
                  {s.schedule === "monthly" ? `Día ${s.monthlyDay} de cada mes` : "Cada quincena"}
                </span>
                <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-haze">
                  {s.estimation === "avg3" ? "Proyecta con el promedio" : "Monto fijo"}
                </span>
                <span className="num ml-auto text-[22px] font-semibold tracking-tight text-mint">{formatMXN(s.expectedCents)}</span>
              </div>
              <p className="mt-2 text-[13px] text-haze">Cae en {account?.name ?? "la cuenta principal"}</p>
              {history.length ? (
                <div className="mt-4 flex flex-wrap gap-2">
                  {history.map((t) => (
                    <span key={t.id} className="num rounded-full bg-white/[.04] px-3 py-1 text-[12px] text-mist ring-1 ring-white/[.06]">
                      {fmtShort(t.periodDate!)} · {formatMXN(t.amountCents, { round: true })}
                    </span>
                  ))}
                </div>
              ) : null}
              <div className="mt-4 border-t border-white/[.06] pt-4">
                <ActionButton action={archiveIncomeSourceAction} fields={{ id: s.id }} variant="danger">
                  Dejar de proyectar
                </ActionButton>
              </div>
            </GlassCard>
          );
        })}
      </ul>
    </div>
  );
}
