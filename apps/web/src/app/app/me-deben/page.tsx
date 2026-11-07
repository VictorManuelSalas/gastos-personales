import { formatMXN } from "@gp/core";
import { contact, creditLine, db, moneyAccount } from "@gp/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { CopyButton } from "@/components/ui/copy-button";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { createLoanAction, forgiveAction, repaymentAction } from "@/server/actions/receivables";
import { receivableBalances } from "@/server/finance/mutations";

export const metadata: Metadata = { title: "Me deben" };

const KIND = { cash: "Préstamo", purchase: "Compra a su nombre", paid_for: "Le pagaste algo" } as const;
const STATUS = { active: "", settled: "Liquidado", forgiven: "Incobrable" } as const;

export default async function ReceivablesPage() {
  const { user } = await requireUser();
  const [people, balances, accounts, lines] = await Promise.all([
    db.select().from(contact).where(eq(contact.userId, user.id)).orderBy(contact.name),
    receivableBalances(user.id),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))).orderBy(desc(moneyAccount.isDefault)),
    db.select().from(creditLine).where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
  ]);
  const active = balances.filter((r) => r.status === "active");
  const total = active.reduce((s, r) => s + r.pendingCents, 0);
  const groups = people
    .map((p) => ({
      person: p,
      items: balances.filter((r) => r.contactId === p.id).sort((a, b) => b.date.localeCompare(a.date)),
      pending: active.filter((r) => r.contactId === p.id).reduce((s, r) => s + r.pendingCents, 0),
    }))
    .filter((g) => g.items.length)
    .sort((a, b) => b.pending - a.pending);

  const message = (name: string, items: typeof balances) => {
    const open = items.filter((r) => r.status === "active");
    const lines = open.map((r) => `• ${r.concept}: ${formatMXN(r.amountCents)}, abonado ${formatMXN(r.paidCents)}, falta ${formatMXN(r.pendingCents)}`);
    return `Hola ${name}, te comparto cómo vamos:\n${lines.join("\n")}\nTotal pendiente: ${formatMXN(open.reduce((s, r) => s + r.pendingCents, 0))}. ¡Gracias!`;
  };

  return (
    <div>
      <PageHeader eyebrow="Me deben" title={<span className="num">{formatMXN(total)}</span>}>
        Lo que prestaste y aún no regresa. Este dinero no cuenta como disponible en tu quincena.
      </PageHeader>

      <Disclosure label="Registrar préstamo" variant="primary" className="rise d3 mt-10" defaultOpen={groups.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <ActionForm action={createLoanAction} closeOnOk className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="ln-contact" className="block text-[12px] text-haze">
                ¿A quién?
              </label>
              <input id="ln-contact" name="contact" list="contacts" placeholder="Nombre" className="field mt-1.5" autoComplete="off" />
              <datalist id="contacts">
                {people.map((p) => (
                  <option key={p.id} value={p.name} />
                ))}
              </datalist>
            </div>
            <div>
              <label htmlFor="ln-amount" className="block text-[12px] text-haze">
                Monto
              </label>
              <input id="ln-amount" name="amount" inputMode="decimal" placeholder="2000" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="ln-concept" className="block text-[12px] text-haze">
                Concepto
              </label>
              <input id="ln-concept" name="concept" placeholder="Lavadora, préstamo para el súper…" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="ln-kind" className="block text-[12px] text-haze">
                Tipo
              </label>
              <select id="ln-kind" name="kind" defaultValue="cash" className="field mt-1.5">
                <option value="cash">Le presté dinero</option>
                <option value="purchase">Compré algo a su nombre</option>
                <option value="paid_for">Le pagué algo (servicio, suscripción)</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ln-source" className="block text-[12px] text-haze">
                ¿De dónde salió?
              </label>
              <select id="ln-source" name="source" defaultValue={accounts[0] ? `a:${accounts[0].id}` : ""} className="field mt-1.5">
                <option value="">No mover saldos (solo anotar)</option>
                {accounts.map((a) => (
                  <option key={a.id} value={`a:${a.id}`}>
                    Cuenta {a.name}
                  </option>
                ))}
                {lines.map((l) => (
                  <option key={l.id} value={`c:${l.id}`}>
                    Tarjeta {l.name} (se suma a su ciclo)
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-2">
              <SubmitButton>Registrar</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>
      </Disclosure>

      <div className="mt-10 grid gap-4">
        {groups.length === 0 ? <EmptyState title="Nadie te debe">Cuando prestes algo, regístralo aquí o con el bot: presté 500 a Ana.</EmptyState> : null}
        {groups.map(({ person, items, pending }) => (
          <GlassCard as="article" key={person.id} interactive={false} className="p-6">
            <div className="flex flex-wrap items-center gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{person.name}</h2>
              <span className={`num ml-auto text-[24px] font-semibold tracking-tight ${pending ? "" : "text-mint"}`}>
                {pending ? formatMXN(pending) : "Al corriente"}
              </span>
            </div>

            <ul className="mt-5 grid gap-2">
              {items.filter((r) => r.status === "active").map((r) => (
                <li key={r.id} className={`flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06] ${r.status !== "active" ? "opacity-60" : ""}`}>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{r.concept}</p>
                    <p className="num mt-0.5 text-[12px] text-haze">
                      {KIND[r.kind]} · {fmtShort(r.date)} {r.date.slice(0, 4)} · {formatMXN(r.amountCents)}
                      {r.paidCents ? ` · abonado ${formatMXN(r.paidCents)}` : ""}
                      {STATUS[r.status] ? ` · ${STATUS[r.status]}` : ""}
                    </p>
                  </div>
                  {r.status === "active" ? (
                    <>
                      <span className="num text-[15px]">{formatMXN(r.pendingCents)}</span>
                      <ActionButton action={forgiveAction} fields={{ id: r.id }} className="!px-3">
                        Incobrable
                      </ActionButton>
                    </>
                  ) : null}
                </li>
              ))}
            </ul>
            {items.some((r) => r.status !== "active") ? (
              <p className="mt-3 text-[12px] text-haze num">
                {items.filter((r) => r.status === "settled").length} liquidados por{" "}
                {formatMXN(items.filter((r) => r.status === "settled").reduce((s, r) => s + r.amountCents, 0))}
                {items.some((r) => r.status === "forgiven") ? ` · ${items.filter((r) => r.status === "forgiven").length} incobrables` : ""}
              </p>
            ) : null}

            {pending ? (
              <div className="mt-5 grid gap-3 border-t border-white/[.06] pt-5 sm:grid-cols-[1fr_auto] sm:items-end">
                <ActionForm action={repaymentAction} okMessage="Abono registrado" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="contactId" value={person.id} />
                  <div>
                    <label htmlFor={`ab-${person.id}`} className="block text-[12px] text-haze">
                      Abono
                    </label>
                    <input id={`ab-${person.id}`} name="amount" inputMode="decimal" placeholder="500" className="field num mt-1.5" />
                  </div>
                  <div>
                    <label htmlFor={`aba-${person.id}`} className="block text-[12px] text-haze">
                      Entró a
                    </label>
                    <select id={`aba-${person.id}`} name="accountId" defaultValue={accounts[0]?.id ?? ""} className="field mt-1.5">
                      <option value="">No mover saldos</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton variant="ghost">Registrar abono</SubmitButton>
                </ActionForm>
                <CopyButton text={message(person.name, items)} label="Copiar recordatorio" done="Copiado" />
              </div>
            ) : null}
          </GlassCard>
        ))}
      </div>
      <p className="mt-6 text-[12px] text-haze">El recordatorio se copia para que tú lo mandes por WhatsApp. La app nunca contacta a nadie.</p>
    </div>
  );
}
