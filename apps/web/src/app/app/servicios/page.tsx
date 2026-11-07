import { addDays, centsToInput, detectSubscriptions, formatMXN, monthStart, today } from "@gp/core";
import { category, contact, creditLine, db, moneyAccount, transaction } from "@gp/db";
import { and, eq, gte, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { archiveBillAction, createBillAction, payBillAction } from "@/server/actions/bills";
import { upcomingBills, userBills } from "@/server/finance/bills";

export const metadata: Metadata = { title: "Servicios" };

const EVERY: Record<number, string> = { 1: "Mensual", 2: "Bimestral", 3: "Trimestral", 6: "Semestral", 12: "Anual" };

export default async function BillsPage() {
  const { user } = await requireUser();
  const now = today();
  const [bills, upcoming, accounts, lines, cats, people, recent] = await Promise.all([
    userBills(user.id),
    upcomingBills(user.id, monthStart(now, -1), addDays(now, 45)),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))),
    db.select().from(creditLine).where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
    db.select().from(category).where(and(eq(category.userId, user.id), eq(category.kind, "expense"), isNull(category.archivedAt))).orderBy(category.sortOrder),
    db.select().from(contact).where(eq(contact.userId, user.id)),
    db
      .select({ merchant: transaction.merchant, amountCents: transaction.amountCents, date: transaction.date })
      .from(transaction)
      .where(and(eq(transaction.userId, user.id), eq(transaction.kind, "expense"), gte(transaction.date, monthStart(now, -6)))),
  ]);
  const suggestions = detectSubscriptions(recent, now, bills.map((b) => b.name));
  const monthly = bills.reduce((s, b) => s + Math.round(b.amountCents / b.everyMonths), 0);
  const subs = bills.filter((b) => b.kind === "subscription");
  const subsCat = cats.find((c) => c.name === "Suscripciones")?.id ?? "";
  const servCat = cats.find((c) => c.name === "Hogar y servicios")?.id ?? "";
  const sourceName = (b: (typeof bills)[number]) =>
    b.creditLineId ? `Tarjeta ${lines.find((l) => l.id === b.creditLineId)?.name ?? ""}` : (accounts.find((a) => a.id === b.accountId)?.name ?? "Cuenta principal");

  return (
    <div>
      <PageHeader eyebrow="Servicios y suscripciones" title={<span className="num">{formatMXN(monthly, { round: true })}</span>}>
        Lo que pagas cada mes en servicios y suscripciones. Te avisamos 3 días antes de cada vencimiento.
      </PageHeader>

      {suggestions.length ? (
        <GlassCard interactive={false} className="rise d3 mt-10 p-6">
          <h2 className="text-lg font-semibold tracking-tight">Parecen suscripciones</h2>
          <p className="mt-1 text-[13px] text-haze">Cargos del mismo comercio, cada mes y por un monto parecido.</p>
          <ul className="mt-4 grid gap-2">
            {suggestions.map((s) => (
              <li key={s.key} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                <div className="min-w-0 flex-1">
                  <p className="text-[14px]">{s.merchant}</p>
                  <p className="num text-[12px] text-haze">
                    {formatMXN(s.amountCents)} · alrededor del día {s.dayOfMonth} · {s.occurrences} cargos
                  </p>
                </div>
                <ActionForm action={createBillAction} className="contents">
                  <input type="hidden" name="name" value={s.merchant} />
                  <input type="hidden" name="amount" value={centsToInput(s.amountCents)} />
                  <input type="hidden" name="day" value={String(s.dayOfMonth)} />
                  <input type="hidden" name="kind" value="subscription" />
                  <input type="hidden" name="categoryId" value={subsCat} />
                  <input type="hidden" name="source" value={accounts[0] ? `a:${accounts[0].id}` : ""} />
                  <SubmitButton variant="ghost" className="!rounded-full !px-4 !py-2 !text-[13px]">
                    Agregar
                  </SubmitButton>
                </ActionForm>
              </li>
            ))}
          </ul>
        </GlassCard>
      ) : null}

      <Disclosure label="Agregar servicio o suscripción" variant="primary" className="rise d3 mt-10" defaultOpen={bills.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <ActionForm action={createBillAction} closeOnOk className="grid gap-4 sm:grid-cols-3">
            <div>
              <label htmlFor="bl-name" className="block text-[12px] text-haze">
                Nombre
              </label>
              <input id="bl-name" name="name" placeholder="Internet, CFE, Netflix" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="bl-kind" className="block text-[12px] text-haze">
                Tipo
              </label>
              <select id="bl-kind" name="kind" defaultValue="service" className="field mt-1.5">
                <option value="service">Servicio (el monto varía)</option>
                <option value="subscription">Suscripción (monto fijo)</option>
              </select>
            </div>
            <div>
              <label htmlFor="bl-amount" className="block text-[12px] text-haze">
                Monto aproximado
              </label>
              <input id="bl-amount" name="amount" inputMode="decimal" placeholder="630" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="bl-day" className="block text-[12px] text-haze">
                Día de vencimiento
              </label>
              <input id="bl-day" name="day" type="number" min={1} max={31} placeholder="10" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="bl-every" className="block text-[12px] text-haze">
                Frecuencia
              </label>
              <select id="bl-every" name="every" defaultValue="1" className="field mt-1.5">
                {Object.entries(EVERY).map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bl-anchor" className="block text-[12px] text-haze">
                Mes del próximo cobro (si no es mensual)
              </label>
              <select id="bl-anchor" name="anchor" defaultValue="" className="field mt-1.5">
                <option value="">Este mes</option>
                {["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"].map((m, i) => (
                  <option key={m} value={i + 1}>
                    {m}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="bl-source" className="block text-[12px] text-haze">
                Se paga con
              </label>
              <select id="bl-source" name="source" defaultValue={accounts[0] ? `a:${accounts[0].id}` : ""} className="field mt-1.5">
                <option value="">Efectivo / sin cuenta</option>
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
            </div>
            <div>
              <label htmlFor="bl-cat" className="block text-[12px] text-haze">
                Categoría
              </label>
              <select id="bl-cat" name="categoryId" defaultValue={servCat} className="field mt-1.5">
                <option value="">Sin categoría</option>
                {cats.map((c) => (
                  <option key={c.id} value={c.id}>{`${c.emoji} ${c.name}`}</option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-[1fr_80px] gap-2">
              <div>
                <label htmlFor="bl-split" className="block text-[12px] text-haze">
                  Dividir con (opcional)
                </label>
                <input id="bl-split" name="splitWith" list="bl-people" placeholder="Nombre" className="field mt-1.5" autoComplete="off" />
                <datalist id="bl-people">
                  {people.map((p) => (
                    <option key={p.id} value={p.name} />
                  ))}
                </datalist>
              </div>
              <div>
                <label htmlFor="bl-parts" className="block text-[12px] text-haze">
                  Entre
                </label>
                <select id="bl-parts" name="splitParts" defaultValue="1" className="field mt-1.5">
                  {[1, 2, 3, 4].map((n) => (
                    <option key={n} value={n}>
                      {n === 1 ? "—" : n}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="sm:col-span-3">
              <SubmitButton>Agregar</SubmitButton>
              <p className="mt-2 text-[12px] text-haze">Si lo divides, cada pago anota la parte de la otra persona en Me deben.</p>
            </div>
          </ActionForm>
        </GlassCard>
      </Disclosure>

      {upcoming.length ? (
        <section className="mt-10">
          <h2 className="eyebrow">Próximos vencimientos</h2>
          <ul className="mt-4 grid gap-2">
            {upcoming.slice(0, 10).map(({ bill: b, date }) => (
              <GlassCard as="li" key={`${b.id}-${date}`} interactive={false} className="p-4">
                <ActionForm action={payBillAction} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="billId" value={b.id} />
                  <input type="hidden" name="period" value={date} />
                  <div className="min-w-0 flex-1">
                    <p className="text-[14px]">{b.name}</p>
                    <p className={`text-[12px] ${date < now ? "text-rose" : "text-haze"}`}>
                      {date < now ? "Venció" : "Vence"} {fmtDay(date)} · {sourceName(b)}
                      {b.splitParts > 1 ? ` · ÷ ${b.splitParts}` : ""}
                    </p>
                  </div>
                  <input name="amount" inputMode="decimal" defaultValue={centsToInput(b.amountCents)} aria-label={`Monto de ${b.name}`} className="field num !w-28 !py-2" />
                  <SubmitButton variant="ghost" className="!rounded-full !px-4 !py-2 !text-[13px]">
                    Pagado
                  </SubmitButton>
                </ActionForm>
              </GlassCard>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <h2 className="eyebrow">Todos</h2>
        {bills.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Sin servicios todavía">Agrega luz, agua, gas, internet y tus suscripciones.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {bills.map((b) => (
              <li key={b.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{b.name}</p>
                  <p className="text-[12px] text-haze">
                    {EVERY[b.everyMonths] ?? `Cada ${b.everyMonths} meses`} · día {b.dayOfMonth} · {sourceName(b)}
                    {b.splitParts > 1 ? ` · ÷ ${b.splitParts} con ${people.find((p) => p.id === b.splitContactId)?.name ?? "otra persona"}` : ""}
                  </p>
                </div>
                <span className="num text-[14px]">{formatMXN(b.amountCents)}</span>
                <ActionButton action={archiveBillAction} fields={{ id: b.id }} className="!px-3">
                  Quitar
                </ActionButton>
              </li>
            ))}
          </ul>
        )}
        {subs.length ? (
          <p className="mt-4 text-[13px] text-haze num">
            Suscripciones: {formatMXN(subs.reduce((s, b) => s + Math.round(b.amountCents / b.everyMonths), 0))} al mes ·{" "}
            {formatMXN(subs.reduce((s, b) => s + Math.round((b.amountCents * 12) / b.everyMonths), 0))} al año. ¿Usas todas?
          </p>
        ) : null}
      </section>
    </div>
  );
}
