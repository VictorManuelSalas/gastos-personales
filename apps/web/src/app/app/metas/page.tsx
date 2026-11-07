import { DEFAULT_PAYDAYS, formatMXN, parsePaydayRule, today } from "@gp/core";
import { db, moneyAccount, user as userTable } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { GoalForm } from "@/components/finance/goal-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { fmtShort } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { avgEssentialMonthly, loadGoals } from "@/server/finance/goals";

export const metadata: Metadata = { title: "Metas" };

export default async function GoalsPage() {
  const { user } = await requireUser();
  const now = today();
  const [[prefs], accounts] = await Promise.all([
    db.select({ payDays: userTable.payDays, policy: userTable.paydayPolicy }).from(userTable).where(eq(userTable.id, user.id)),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))),
  ]);
  const rule = (prefs && parsePaydayRule(prefs.payDays, prefs.policy)) ?? DEFAULT_PAYDAYS;
  const [goals, avg] = await Promise.all([loadGoals(user.id, rule, now), avgEssentialMonthly(user.id, now)]);
  const total = goals.reduce((s, g) => s + g.savedCents, 0);
  const hasEmergency = goals.some((g) => g.kind === "emergency");

  return (
    <div>
      <PageHeader eyebrow="Metas" title={<span className="num">{formatMXN(total)}</span>}>
        Apartado para lo que importa. Lo que apartas deja de contar como disponible, así no se gasta por accidente.
      </PageHeader>

      <Disclosure label="Nueva meta" variant="primary" className="rise d3 mt-10" defaultOpen={goals.length === 0}>
        <GlassCard interactive={false} className="p-6 md:p-8">
          <GoalForm
            accounts={accounts.filter((a) => a.kind === "savings").map((a) => ({ id: a.id, label: a.name }))}
            avgEssentialLabel={avg > 0 ? formatMXN(avg, { round: true }) : null}
            hasEmergency={hasEmergency}
          />
        </GlassCard>
      </Disclosure>

      {!hasEmergency && goals.length > 0 ? (
        <p className="mt-6 rounded-2xl bg-amber/10 px-5 py-4 text-[14px] text-amber ring-1 ring-amber/25">
          Aún no tienes fondo de emergencia. Es la meta que más te protege; considera empezar por ahí.
        </p>
      ) : null}

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {goals.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="Sin metas todavía">Empieza por tu fondo de emergencia, aunque sea con un mes de gastos.</EmptyState>
          </div>
        ) : null}
        {goals.map((g) => (
          <Link key={g.id} href={`/app/metas/${g.id}`} className="block">
            <GlassCard as="article" className="h-full p-6">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-[13px] text-mist">
                    <span className="mr-1.5">{g.emoji}</span>
                    {g.name}
                  </p>
                  <p className="num mt-3 text-[34px] font-semibold leading-none tracking-tighter">{formatMXN(g.savedCents, { round: true })}</p>
                  <p className="num mt-1.5 text-[13px] text-haze">
                    {g.targetCents ? `de ${formatMXN(g.targetCents, { round: true })}${g.targetComputed ? " (calculado)" : ""}` : "Sin objetivo"}
                  </p>
                </div>
                <span className="num text-[22px] font-semibold tracking-tight text-mint">{g.progress}%</span>
              </div>
              <div className="mt-5 h-1.5 rounded-full bg-white/[.06]">
                <div className="h-full rounded-full bg-gradient-to-r from-[#bff5df] to-mint" style={{ width: `${g.progress}%` }} />
              </div>
              <p className="mt-4 text-[13px] text-mist">
                {g.autoCents
                  ? `Apartas ${formatMXN(g.autoCents, { round: true })} cada cobro${g.reachDate ? ` · llegas el ${fmtShort(g.reachDate)} ${g.reachDate.slice(0, 4)}` : ""}`
                  : g.suggestedCents
                    ? `Para llegar a tiempo: ${formatMXN(g.suggestedCents, { round: true })} por quincena`
                    : "Aporta cuando puedas, desde aquí o con el bot: aparta 500"}
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
