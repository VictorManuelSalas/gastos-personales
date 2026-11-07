import { centsToInput, formatMXN } from "@gp/core";
import { db, moneyAccount } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { archiveAccountAction, createAccountAction, setDefaultAccountAction, updateAccountAction } from "@/server/actions/accounts";

export const metadata: Metadata = { title: "Cuentas" };

const KIND = { debit: "Débito", cash: "Efectivo", savings: "Ahorro" } as const;

export default async function AccountsPage() {
  const { user } = await requireUser();
  const accounts = await db
    .select()
    .from(moneyAccount)
    .where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt)))
    .orderBy(moneyAccount.createdAt);
  const available = accounts.filter((a) => a.inAvailable).reduce((s, a) => s + a.balanceCents, 0);

  return (
    <div>
      <PageHeader eyebrow="Cuentas" title={<span className="num">{formatMXN(available)}</span>}>
        Disponible hoy, sumando las cuentas que cuentan para tu quincena. Actualiza el saldo cuando no coincida con tu banco.
      </PageHeader>

      <Disclosure label="Agregar cuenta" variant="primary" className="rise d3 mt-10" defaultOpen={accounts.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <ActionForm action={createAccountAction} closeOnOk className="grid gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <label htmlFor="ac-name" className="block text-[12px] text-haze">
                Nombre
              </label>
              <input id="ac-name" name="name" placeholder="BBVA débito" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="ac-kind" className="block text-[12px] text-haze">
                Tipo
              </label>
              <select id="ac-kind" name="kind" defaultValue="debit" className="field mt-1.5">
                <option value="debit">Débito</option>
                <option value="cash">Efectivo</option>
                <option value="savings">Ahorro (no cuenta como disponible)</option>
              </select>
            </div>
            <div>
              <label htmlFor="ac-bal" className="block text-[12px] text-haze">
                Saldo actual
              </label>
              <input id="ac-bal" name="balance" inputMode="decimal" placeholder="12500" className="field num mt-1.5" />
            </div>
            <div className="sm:col-span-3">
              <SubmitButton>Agregar</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>
      </Disclosure>

      <ul className="mt-10 grid gap-3">
        {accounts.length === 0 ? (
          <EmptyState title="Sin cuentas todavía">Agrega la cuenta donde te depositan y, si quieres, tu efectivo.</EmptyState>
        ) : null}
        {accounts.map((a) => (
          <GlassCard as="li" key={a.id} interactive={false} className="p-5 md:p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-[17px] font-semibold tracking-tight">{a.name}</h2>
              <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-haze">{KIND[a.kind]}</span>
              {a.isDefault ? <span className="rounded-full bg-glow/10 px-2.5 py-0.5 text-[11px] text-glow">Principal</span> : null}
              {!a.inAvailable ? <span className="rounded-full bg-white/5 px-2.5 py-0.5 text-[11px] text-haze">No suma al disponible</span> : null}
              <span className="num ml-auto text-[22px] font-semibold tracking-tight">{formatMXN(a.balanceCents)}</span>
            </div>
            <ActionForm action={updateAccountAction} resetOnOk={false} okMessage="Saldo actualizado" className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="id" value={a.id} />
              <div>
                <label htmlFor={`n-${a.id}`} className="block text-[12px] text-haze">
                  Nombre
                </label>
                <input id={`n-${a.id}`} name="name" defaultValue={a.name} className="field mt-1.5" />
              </div>
              <div>
                <label htmlFor={`b-${a.id}`} className="block text-[12px] text-haze">
                  Saldo real hoy
                </label>
                <input id={`b-${a.id}`} name="balance" inputMode="decimal" defaultValue={centsToInput(a.balanceCents)} className="field num mt-1.5" />
              </div>
              <SubmitButton variant="ghost">Guardar</SubmitButton>
              <label className="flex items-center gap-2 text-[13px] text-mist sm:col-span-3">
                <input type="checkbox" name="inAvailable" defaultChecked={a.inAvailable} className="h-4 w-4 accent-[#8fa8ff]" />
                Cuenta para el disponible de mi quincena
              </label>
            </ActionForm>
            <div className="mt-4 flex flex-wrap gap-2 border-t border-white/[.06] pt-4">
              {!a.isDefault ? (
                <ActionButton action={setDefaultAccountAction} fields={{ id: a.id }}>
                  Hacer principal
                </ActionButton>
              ) : null}
              <ActionButton action={archiveAccountAction} fields={{ id: a.id }} variant="danger">
                Archivar
              </ActionButton>
            </div>
          </GlassCard>
        ))}
      </ul>
    </div>
  );
}
