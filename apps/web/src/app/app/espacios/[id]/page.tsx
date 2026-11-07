import { centsToInput, formatMXN, progressPct } from "@gp/core";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtDay } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import {
  addMemberAction,
  addSharedExpenseAction,
  contributeSpaceGoalAction,
  createSpaceGoalAction,
  deleteSharedExpenseAction,
  leaveSpaceAction,
  settleAction,
} from "@/server/actions/spaces";
import { spaceDetail } from "@/server/finance/spaces";

export const metadata: Metadata = { title: "Espacio" };

export default async function SpacePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const d = await spaceDetail(id, user.id);
  if (!d) notFound();
  const nameOf = (uid: string | null) => (uid === user.id ? "Tú" : (d.members.find((m) => m.id === uid)?.name.split(" ")[0] ?? "Alguien"));
  const mine = d.balances.get(user.id) ?? 0;

  return (
    <div>
      <Link href="/app/espacios" className="text-[13px] text-haze transition-colors hover:text-ink">
        ← Espacios
      </Link>
      <section className="mt-6">
        <p className="eyebrow rise">{d.members.map((m) => m.name.split(" ")[0]).join(" · ")}</p>
        <h1 className="rise d1 mt-4 text-[clamp(2.6rem,7vw,4.6rem)] font-semibold leading-[0.95] tracking-tighter chrome">{d.space.name}</h1>
        <p className={`num rise d2 mt-4 text-xl ${mine > 0 ? "text-mint" : mine < 0 ? "text-amber" : "text-mist"}`}>
          {mine > 0 ? `Te deben ${formatMXN(mine)}` : mine < 0 ? `Debes ${formatMXN(-mine)}` : "Están a mano"}
        </p>
      </section>

      <div className="mt-10 grid gap-4 lg:grid-cols-2">
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Agregar gasto</h2>
          <ActionForm action={addSharedExpenseAction} className="mt-4 grid gap-3 sm:grid-cols-2">
            <input type="hidden" name="spaceId" value={d.space.id} />
            <div>
              <label htmlFor="se-concept" className="block text-[12px] text-haze">
                Concepto
              </label>
              <input id="se-concept" name="concept" placeholder="Internet de noviembre" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="se-amount" className="block text-[12px] text-haze">
                Monto
              </label>
              <input id="se-amount" name="amount" inputMode="decimal" placeholder="630" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="se-paid" className="block text-[12px] text-haze">
                Pagó
              </label>
              <select id="se-paid" name="paidBy" defaultValue={user.id} className="field mt-1.5">
                {d.members.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.id === user.id ? "Yo" : m.name}
                  </option>
                ))}
              </select>
            </div>
            <fieldset>
              <legend className="text-[12px] text-haze">Se divide entre</legend>
              <div className="mt-2 flex flex-wrap gap-3">
                {d.members.map((m) => (
                  <label key={m.id} className="flex items-center gap-1.5 text-[13px] text-mist">
                    <input type="checkbox" name="participants" value={m.id} defaultChecked className="h-4 w-4 accent-[#8fa8ff]" />
                    {m.id === user.id ? "Yo" : m.name.split(" ")[0]}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="sm:col-span-2">
              <SubmitButton>Agregar</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>

        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Para quedar a mano</h2>
          {d.transfers.length ? (
            <ul className="mt-4 grid gap-2">
              {d.transfers.map((t) => (
                <li key={`${t.from}-${t.to}`} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                  <span className="min-w-0 flex-1 text-[14px]">
                    {nameOf(t.from)} → {nameOf(t.to)}
                  </span>
                  <span className="num">{formatMXN(t.amountCents)}</span>
                  <ActionForm action={settleAction} className="contents">
                    <input type="hidden" name="spaceId" value={d.space.id} />
                    <input type="hidden" name="from" value={t.from} />
                    <input type="hidden" name="to" value={t.to} />
                    <input type="hidden" name="amount" value={centsToInput(t.amountCents)} />
                    <SubmitButton variant="ghost" className="!rounded-full !px-3 !py-1.5 !text-[12px]">
                      Ya se pagó
                    </SubmitButton>
                  </ActionForm>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-[14px] text-mist">Todos están a mano. 🎉</p>
          )}
          <ul className="mt-6 grid gap-1.5 text-[13px]">
            {d.members.map((m) => {
              const b = d.balances.get(m.id) ?? 0;
              return (
                <li key={m.id} className="flex justify-between">
                  <span className="text-mist">{m.id === user.id ? "Tú" : m.name}</span>
                  <span className={`num ${b > 0 ? "text-mint" : b < 0 ? "text-amber" : "text-haze"}`}>{b === 0 ? "a mano" : `${b > 0 ? "+" : "−"}${formatMXN(Math.abs(b))}`}</span>
                </li>
              );
            })}
          </ul>
        </GlassCard>
      </div>

      <section className="mt-10">
        <h2 className="eyebrow">Metas compartidas</h2>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          {d.goals.map((g) => (
            <GlassCard as="article" key={g.id} interactive={false} className="p-5">
              <div className="flex items-baseline justify-between gap-3">
                <p className="text-[15px] font-medium">
                  {g.emoji} {g.name}
                </p>
                <span className="num text-mint">{progressPct(g.savedCents, g.targetCents)}%</span>
              </div>
              <p className="num mt-1 text-[13px] text-haze">
                {formatMXN(g.savedCents)} de {formatMXN(g.targetCents)}
                {g.targetDate ? ` · para el ${fmtDay(g.targetDate)}` : ""}
              </p>
              <div className="mt-3 h-1.5 rounded-full bg-white/[.06]">
                <div className="h-full rounded-full bg-mint/80" style={{ width: `${progressPct(g.savedCents, g.targetCents)}%` }} />
              </div>
              <p className="mt-3 text-[12px] text-haze">{g.byMember.map((m) => `${m.id === user.id ? "Tú" : m.name.split(" ")[0]} ${formatMXN(m.cents, { round: true })}`).join(" · ")}</p>
              <ActionForm action={contributeSpaceGoalAction} className="mt-3 grid grid-cols-[1fr_auto] gap-2">
                <input type="hidden" name="spaceId" value={d.space.id} />
                <input type="hidden" name="goalId" value={g.id} />
                <input name="amount" inputMode="decimal" placeholder="Monto" aria-label={`Aporte a ${g.name}`} className="field num !py-2" />
                <SubmitButton variant="ghost" className="!py-2">
                  Aportar
                </SubmitButton>
              </ActionForm>
            </GlassCard>
          ))}
        </div>
        <Disclosure label="Nueva meta compartida" className="mt-4">
          <GlassCard interactive={false} className="p-5">
            <ActionForm action={createSpaceGoalAction} closeOnOk className="grid gap-3 sm:grid-cols-[72px_1fr_1fr_1fr_auto] sm:items-end">
              <input type="hidden" name="spaceId" value={d.space.id} />
              <input name="emoji" maxLength={4} placeholder="🏖️" aria-label="Emoji" className="field text-center" />
              <input name="name" placeholder="Vacaciones familiares" aria-label="Nombre" className="field" />
              <input name="target" inputMode="decimal" placeholder="30000" aria-label="Objetivo" className="field num" />
              <input name="targetDate" type="date" aria-label="Fecha objetivo" className="field" />
              <SubmitButton>Crear</SubmitButton>
            </ActionForm>
          </GlassCard>
        </Disclosure>
      </section>

      <section className="mt-10">
        <h2 className="eyebrow">Historial</h2>
        {d.expenses.length ? (
          <ul className="mt-4 grid gap-2">
            {d.expenses.map((e) => {
              const myShare = d.shares.find((s) => s.expenseId === e.id && s.userId === user.id)?.shareCents;
              return (
                <li key={e.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px]">{e.kind === "settlement" ? `${nameOf(e.paidBy)} le pagó a ${nameOf(e.paidTo)}` : e.concept}</p>
                    <p className="text-[12px] text-haze">
                      {fmtDay(e.date)}
                      {e.kind === "expense" ? ` · pagó ${nameOf(e.paidBy)}${myShare != null ? ` · tu parte ${formatMXN(myShare)}` : ""}` : ""}
                    </p>
                  </div>
                  <span className="num text-[15px]">{formatMXN(e.amountCents)}</span>
                  <ActionButton action={deleteSharedExpenseAction} fields={{ id: e.id, spaceId: d.space.id }} className="!px-3">
                    ✕
                  </ActionButton>
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-mist">Aún no hay gastos.</p>
        )}
      </section>

      <section className="mt-10 flex flex-wrap items-start gap-3">
        <Disclosure label="Agregar miembro" className="w-full">
          <GlassCard interactive={false} className="p-5">
            <ActionForm action={addMemberAction} okMessage="Agregado" className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
              <input type="hidden" name="spaceId" value={d.space.id} />
              <div>
                <label htmlFor="sp-email" className="block text-[12px] text-haze">
                  Correo de su cuenta en Quincena
                </label>
                <input id="sp-email" name="email" type="email" placeholder="ana@correo.com" className="field mt-1.5" />
              </div>
              <SubmitButton>Agregar</SubmitButton>
            </ActionForm>
          </GlassCard>
        </Disclosure>
        <ActionButton action={leaveSpaceAction} fields={{ spaceId: d.space.id }} variant="danger">
          Salir del espacio
        </ActionButton>
      </section>
    </div>
  );
}
