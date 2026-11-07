import { formatMXN } from "@gp/core";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { computeNetWorth } from "@/server/finance/networth";
import { loadFinance } from "@/server/finance/overview";

export const metadata: Metadata = { title: "Patrimonio" };

export default async function NetWorthPage() {
  const { user } = await requireUser();
  const f = await loadFinance(user.id);
  const nw = await computeNetWorth(user.id, f);

  const List = ({ items }: { items: { label: string; cents: number; note: string }[] }) => (
    <ul className="mt-4 grid gap-2">
      {items.map((i, k) => (
        <li key={`${i.label}-${k}`} className="flex items-center justify-between gap-4 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
          <div className="min-w-0">
            <p className="truncate text-[14px]">{i.label}</p>
            <p className="text-[12px] text-haze">{i.note}</p>
          </div>
          <span className="num shrink-0 text-[15px]">{formatMXN(i.cents, { round: true })}</span>
        </li>
      ))}
    </ul>
  );

  return (
    <div>
      <PageHeader eyebrow="Patrimonio neto" title={<span className={`num ${nw.net < 0 ? "text-rose" : ""}`}>{formatMXN(nw.net, { round: true })}</span>}>
        Lo que tienes menos lo que debes. Si este número sube mes con mes, vas por buen camino.
      </PageHeader>
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <GlassCard interactive={false} className="p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Lo que tienes</h2>
            <span className="num text-mint">{formatMXN(nw.assets, { round: true })}</span>
          </div>
          {nw.assetItems.length ? <List items={nw.assetItems} /> : <p className="mt-4 text-[13px] text-haze">Agrega tus cuentas.</p>}
        </GlassCard>
        <GlassCard interactive={false} className="p-6">
          <div className="flex items-baseline justify-between">
            <h2 className="text-lg font-semibold tracking-tight">Lo que debes</h2>
            <span className="num">{formatMXN(nw.liabilities, { round: true })}</span>
          </div>
          {nw.liabilityItems.length ? <List items={nw.liabilityItems} /> : <p className="mt-4 text-[13px] text-haze">Sin deudas registradas.</p>}
        </GlassCard>
      </div>
      {nw.loansIncomplete ? <p className="mt-4 text-[13px] text-amber">Algún préstamo no tiene mensualidades restantes; captúralas en su tarjeta para que el cálculo sea completo.</p> : null}
    </div>
  );
}
