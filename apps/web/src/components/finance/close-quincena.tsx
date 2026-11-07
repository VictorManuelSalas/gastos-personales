import { centsToInput, formatMXN } from "@gp/core";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtShort } from "@/lib/dates";
import { closeQuincenaAction } from "@/server/actions/accounts";

/** Tarjeta de cierre de la quincena anterior: confirma o corrige el saldo real. */
export function CloseQuincena({ payday, accounts }: { payday: string; accounts: { id: string; name: string; balanceCents: number }[] }) {
  return (
    <GlassCard interactive={false} className="rise d3 mt-10 p-6 md:p-8">
      <p className="eyebrow">Cierre de quincena</p>
      <h2 className="mt-3 text-xl font-semibold tracking-tight">¿Cuadra tu saldo? Cierra la quincena del {fmtShort(payday)}.</h2>
      <p className="mt-2 text-[14px] text-mist">Compara con tu app del banco. Si coincide, solo confirma; si no, escribe el saldo real y la app se ajusta.</p>
      <ActionForm action={closeQuincenaAction} className="mt-5 grid gap-3 sm:grid-cols-2">
        <input type="hidden" name="payday" value={payday} />
        {accounts.map((a) => (
          <div key={a.id}>
            <label htmlFor={`cq-${a.id}`} className="block text-[12px] text-haze">
              {a.name} · la app dice {formatMXN(a.balanceCents)}
            </label>
            <input id={`cq-${a.id}`} name={`balance_${a.id}`} inputMode="decimal" defaultValue={centsToInput(a.balanceCents)} className="field num mt-1.5" />
          </div>
        ))}
        <div className="sm:col-span-2">
          <SubmitButton>Cuadra, cerrar quincena</SubmitButton>
        </div>
      </ActionForm>
    </GlassCard>
  );
}
