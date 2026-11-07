import { category, db } from "@gp/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { archiveCategoryAction, createCategoryAction, restoreCategoryAction } from "@/server/actions/money";
import { ensureDefaultCategories } from "@/server/finance/defaults";

export const metadata: Metadata = { title: "Categorías" };

const KLASS = { essential: "Esencial", lifestyle: "Estilo de vida", savings: "Ahorro y deuda" } as const;

export default async function CategoriesPage() {
  const { user } = await requireUser();
  await ensureDefaultCategories(user.id);
  const all = await db.select().from(category).where(eq(category.userId, user.id)).orderBy(category.sortOrder, category.name);
  const active = all.filter((c) => !c.archivedAt);
  const archived = all.filter((c) => c.archivedAt);

  const group = (kind: "expense" | "income") => active.filter((c) => c.kind === kind);

  return (
    <div>
      <PageHeader eyebrow="Categorías" title="En qué se va tu dinero.">
        Las categorías marcadas como antojo cuentan para tus gastos hormiga. Las que archives no se borran: conservan su historial.
      </PageHeader>

      <Disclosure label="Nueva categoría" variant="primary" className="rise d3 mt-10">
        <GlassCard interactive={false} className="p-6 md:p-8">
          <ActionForm action={createCategoryAction} closeOnOk className="grid gap-4 sm:grid-cols-[90px_1fr_1fr]">
            <div>
              <label htmlFor="ct-emoji" className="block text-[12px] text-haze">
                Emoji
              </label>
              <input id="ct-emoji" name="emoji" maxLength={4} placeholder="🐾" className="field mt-1.5 text-center" />
            </div>
            <div>
              <label htmlFor="ct-name" className="block text-[12px] text-haze">
                Nombre
              </label>
              <input id="ct-name" name="name" placeholder="Mascotas" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="ct-kind" className="block text-[12px] text-haze">
                Tipo
              </label>
              <select id="ct-kind" name="kind" defaultValue="expense" className="field mt-1.5">
                <option value="expense">Gasto</option>
                <option value="income">Ingreso</option>
              </select>
            </div>
            <div className="sm:col-span-2">
              <label htmlFor="ct-klass" className="block text-[12px] text-haze">
                Clase (para la regla 50/30/20)
              </label>
              <select id="ct-klass" name="klass" defaultValue="lifestyle" className="field mt-1.5">
                <option value="essential">Esencial</option>
                <option value="lifestyle">Estilo de vida</option>
                <option value="savings">Ahorro y deuda</option>
              </select>
            </div>
            <label className="flex items-center gap-2 self-end pb-3 text-[13px] text-mist">
              <input type="checkbox" name="isAnt" className="h-4 w-4 accent-[#8fa8ff]" />
              Es antojo (gasto hormiga)
            </label>
            <div className="sm:col-span-3">
              <SubmitButton>Crear</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>
      </Disclosure>

      {(["expense", "income"] as const).map((kind) => (
        <section key={kind} className="mt-12">
          <h2 className="eyebrow">{kind === "expense" ? "Gastos" : "Ingresos"}</h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {group(kind).map((c) => (
              <li key={c.id} className="flex items-center gap-3 rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white/[.05] text-[16px]" aria-hidden="true">
                  {c.emoji}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px]">{c.name}</p>
                  <p className="text-[11px] text-haze">
                    {KLASS[c.klass]}
                    {c.isAnt ? " · antojo" : ""}
                  </p>
                </div>
                <ActionButton action={archiveCategoryAction} fields={{ id: c.id }} className="!px-3">
                  Archivar
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ))}

      {archived.length ? (
        <section className="mt-12">
          <h2 className="eyebrow">Archivadas</h2>
          <ul className="mt-4 flex flex-wrap gap-2">
            {archived.map((c) => (
              <li key={c.id} className="flex items-center gap-2 rounded-full bg-white/[.03] py-1 pl-3 pr-1 text-[13px] text-mist ring-1 ring-white/[.06]">
                {c.emoji} {c.name}
                <ActionButton action={restoreCategoryAction} fields={{ id: c.id }} className="!px-3 !py-1 !text-[12px]">
                  Restaurar
                </ActionButton>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
