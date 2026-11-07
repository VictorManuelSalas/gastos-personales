import { centsToInput, DEFAULT_PAYDAYS, formatMXN, parsePaydayRule, today } from "@gp/core";
import { db, user as userTable } from "@gp/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtDay, fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { archiveGoalAction, contributeGoalAction, startTravelAction, stopTravelAction, updateGoalAction } from "@/server/actions/goals";
import { activeTravel, spentWithTag, upsertTagLookup } from "@/server/finance/tags";
import { loadGoals } from "@/server/finance/goals";

export const metadata: Metadata = { title: "Meta" };

export default async function GoalPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { user } = await requireUser();
  const [prefs] = await db.select({ payDays: userTable.payDays, policy: userTable.paydayPolicy }).from(userTable).where(eq(userTable.id, user.id));
  const rule = (prefs && parsePaydayRule(prefs.payDays, prefs.policy)) ?? DEFAULT_PAYDAYS;
  const g = (await loadGoals(user.id, rule, today())).find((x) => x.id === id);
  if (!g) notFound();

  const travel = await activeTravel(user.id);
  const travelingHere = travel?.goalId === g.id;
  const goalTag = await upsertTagLookup(user.id, g.id);
  const spentTrip = goalTag ? await spentWithTag(user.id, goalTag.id) : 0;

  const r = 52;
  const circ = 2 * Math.PI * r;

  return (
    <div>
      <Link href="/app/metas" className="text-[13px] text-haze transition-colors hover:text-ink">
        ← Metas
      </Link>

      <section className="mt-6 grid items-center gap-10 md:grid-cols-[1fr_auto]">
        <div>
          <p className="eyebrow rise">
            {g.emoji} {g.kind === "emergency" ? `Fondo de emergencia · ${g.emergencyMonths ?? 3} ${(g.emergencyMonths ?? 3) === 1 ? "mes" : "meses"} de gastos` : "Meta"}
          </p>
          <h1 className="rise d1 mt-4 text-[clamp(2.6rem,7vw,4.6rem)] font-semibold leading-[0.95] tracking-tighter chrome">{g.name}</h1>
          <p className="num rise d2 mt-5 text-lg text-mist">
            {formatMXN(g.savedCents)} {g.targetCents ? `de ${formatMXN(g.targetCents)}` : "ahorrados"}
            {g.targetComputed ? " · objetivo calculado con tus gastos esenciales" : ""}
          </p>
          <p className="rise d2 mt-2 text-[14px] text-haze">
            {[
              g.targetDate ? `Fecha objetivo: ${fmtDay(g.targetDate)} ${g.targetDate.slice(0, 4)}` : null,
              g.suggestedCents ? `para llegar a tiempo aparta ${formatMXN(g.suggestedCents)} por quincena` : null,
              g.reachDate && g.autoCents ? `a este ritmo llegas el ${fmtShort(g.reachDate)} ${g.reachDate.slice(0, 4)}` : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </div>
        <svg viewBox="0 0 120 120" className="rise d2 h-36 w-36 -rotate-90" aria-label={`${g.progress} por ciento`}>
          <defs>
            <linearGradient id="gg" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stopColor="#bff5df" />
              <stop offset="1" stopColor="#6fe3b5" />
            </linearGradient>
          </defs>
          <circle cx="60" cy="60" r={r} fill="none" stroke="rgb(255 255 255 / .08)" strokeWidth="10" />
          <circle cx="60" cy="60" r={r} fill="none" stroke="url(#gg)" strokeWidth="10" strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={circ * (1 - g.progress / 100)} />
        </svg>
      </section>

      <div className="mt-12 grid gap-4 md:grid-cols-2">
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Apartar</h2>
          <ActionForm action={contributeGoalAction} okMessage="Apartado" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="goalId" value={g.id} />
            <div>
              <label htmlFor="ct-amt" className="block text-[12px] text-haze">
                Monto
              </label>
              <input id="ct-amt" name="amount" inputMode="decimal" defaultValue={centsToInput(g.autoCents ?? g.suggestedCents)} className="field num mt-1.5" />
            </div>
            <SubmitButton>Apartar</SubmitButton>
          </ActionForm>
        </GlassCard>
        <GlassCard interactive={false} className="p-6">
          <h2 className="text-lg font-semibold tracking-tight">Usar dinero de la meta</h2>
          <ActionForm action={contributeGoalAction} okMessage="Registrado" className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <input type="hidden" name="goalId" value={g.id} />
            <input type="hidden" name="direction" value="out" />
            <div>
              <label htmlFor="wd-amt" className="block text-[12px] text-haze">
                Monto
              </label>
              <input id="wd-amt" name="amount" inputMode="decimal" className="field num mt-1.5" />
            </div>
            <SubmitButton variant="ghost">Retirar</SubmitButton>
          </ActionForm>
        </GlassCard>
      </div>

      {g.kind === "goal" ? (
        <GlassCard interactive={false} className="mt-4 flex flex-wrap items-center gap-4 p-6">
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{travelingHere ? `Modo viaje activo · #${travel!.name}` : "Modo viaje"}</h2>
            <p className="mt-1 text-[13px] text-mist">
              {travelingHere
                ? "Todo lo que registres por el bot lleva esta etiqueta y se descuenta de la meta."
                : "Al activarlo, lo que registres por el bot se etiqueta con esta meta y se descuenta de lo apartado."}
              {spentTrip ? ` Gastado con la etiqueta: ${formatMXN(spentTrip)}.` : ""}
            </p>
          </div>
          {travelingHere ? (
            <ActionButton action={stopTravelAction} fields={{ id: g.id }}>
              Terminar viaje
            </ActionButton>
          ) : (
            <ActionButton action={startTravelAction} fields={{ id: g.id }} variant="primary">
              Activar modo viaje
            </ActionButton>
          )}
        </GlassCard>
      ) : null}

      <section className="mt-12">
        <h2 className="eyebrow">Movimientos</h2>
        {g.movements.length ? (
          <ul className="mt-4 grid gap-2">
            {g.movements.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-2xl bg-white/[.03] px-4 py-3 text-[14px] ring-1 ring-white/[.06]">
                <span className="text-mist">
                  {fmtDay(m.date)}
                  {m.periodDate ? " · aporte de la quincena" : m.note ? ` · ${m.note}` : ""}
                  {m.origin === "telegram" ? " · Telegram" : ""}
                </span>
                <span className={`num ${m.amountCents >= 0 ? "text-mint" : ""}`}>
                  {m.amountCents >= 0 ? "+" : "−"}
                  {formatMXN(Math.abs(m.amountCents))}
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-mist">Aún no hay aportes. El primero es el más importante.</p>
        )}
      </section>

      <section className="mt-12 flex flex-wrap items-start gap-3">
        <Disclosure label="Editar meta" className="w-full">
          <GlassCard interactive={false} className="p-6">
            <ActionForm action={updateGoalAction} resetOnOk={false} closeOnOk className="grid gap-4 sm:grid-cols-2">
              <input type="hidden" name="id" value={g.id} />
              <div className="sm:col-span-2">
                <label htmlFor="ed-name" className="block text-[12px] text-haze">
                  Nombre
                </label>
                <input id="ed-name" name="name" defaultValue={g.name} className="field mt-1.5" />
              </div>
              <div>
                <label htmlFor="ed-target" className="block text-[12px] text-haze">
                  Objetivo {g.kind === "emergency" ? "(vacío = calcularlo)" : ""}
                </label>
                <input id="ed-target" name="target" inputMode="decimal" defaultValue={centsToInput(g.kind === "emergency" && g.targetComputed ? null : g.targetCents)} className="field num mt-1.5" />
              </div>
              <div>
                <label htmlFor="ed-date" className="block text-[12px] text-haze">
                  Fecha objetivo
                </label>
                <input id="ed-date" name="targetDate" type="date" defaultValue={g.targetDate ?? ""} className="field mt-1.5" />
              </div>
              <div>
                <label htmlFor="ed-auto" className="block text-[12px] text-haze">
                  Aporte automático por cobro
                </label>
                <input id="ed-auto" name="auto" inputMode="decimal" defaultValue={centsToInput(g.autoCents)} className="field num mt-1.5" />
              </div>
              {g.kind === "emergency" ? (
                <div>
                  <label htmlFor="ed-months" className="block text-[12px] text-haze">
                    Meses de gastos
                  </label>
                  <select id="ed-months" name="months" defaultValue={String(g.emergencyMonths ?? 3)} className="field mt-1.5">
                    <option value="1">1</option>
                    <option value="3">3</option>
                    <option value="6">6</option>
                  </select>
                </div>
              ) : null}
              <div className="sm:col-span-2">
                <SubmitButton>Guardar</SubmitButton>
              </div>
            </ActionForm>
          </GlassCard>
        </Disclosure>
        <ActionButton action={archiveGoalAction} fields={{ id: g.id }} variant="danger">
          Archivar meta
        </ActionButton>
      </section>
    </div>
  );
}
