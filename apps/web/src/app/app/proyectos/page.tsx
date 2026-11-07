import { formatMXN } from "@gp/core";
import { db, moneyAccount } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { createProjectAction } from "@/server/actions/projects";
import { loadProjects } from "@/server/finance/projects";

export const metadata: Metadata = { title: "Proyectos" };

export default async function ProjectsPage() {
  const { user } = await requireUser();
  const [projects, accounts] = await Promise.all([
    loadProjects(user.id),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt))),
  ]);
  return (
    <div>
      <PageHeader eyebrow="Proyectos y negocios" title="Lo del negocio, aparte.">
        Clientes, cobros y costos de cada proyecto separados de tus gastos personales, con la ganancia real y cuándo recuperas lo invertido.
      </PageHeader>

      <Disclosure label="Nuevo proyecto" variant="primary" className="rise d3 mt-10" defaultOpen={projects.length === 0}>
        <GlassCard interactive={false} className="p-6">
          <ActionForm action={createProjectAction} className="grid gap-3 sm:grid-cols-[1.2fr_1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="pj-name" className="block text-[12px] text-haze">
                Nombre
              </label>
              <input id="pj-name" name="name" placeholder="Reventa de internet" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="pj-inv" className="block text-[12px] text-haze">
                Inversión total
              </label>
              <input id="pj-inv" name="investment" inputMode="decimal" placeholder="4158" className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="pj-acc" className="block text-[12px] text-haze">
                Los cobros entran a
              </label>
              <select id="pj-acc" name="accountId" defaultValue="" className="field mt-1.5">
                <option value="">Cuenta principal</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <SubmitButton>Crear</SubmitButton>
          </ActionForm>
        </GlassCard>
      </Disclosure>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {projects.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="Sin proyectos">Si tienes un negocio, aunque sea pequeño, sepáralo aquí para saber si de verdad te deja.</EmptyState>
          </div>
        ) : null}
        {projects.map((s) =>
          s ? (
            <Link key={s.project.id} href={`/app/proyectos/${s.project.id}`} className="block">
              <GlassCard as="article" className="h-full p-6">
                <h2 className="text-xl font-semibold tracking-tight">{s.project.name}</h2>
                <p className="mt-1 text-[13px] text-haze">{s.clients.filter((c) => c.active).length} clientes activos</p>
                <p className={`num mt-5 text-[28px] font-semibold leading-none tracking-tighter ${s.avgProfitCents < 0 ? "text-rose" : ""}`}>
                  {formatMXN(s.avgProfitCents, { round: true })}
                  <span className="text-[14px] font-normal text-haze"> / mes</span>
                </p>
                <p className="mt-2 text-[13px] text-mist">
                  {s.paybackMonths == null
                    ? "Aún sin ganancia para calcular el retorno"
                    : s.paybackMonths === 0
                      ? "Sin inversión registrada"
                      : `Recuperas la inversión en ${s.paybackMonths} meses`}
                </p>
              </GlassCard>
            </Link>
          ) : null,
        )}
      </div>
    </div>
  );
}
