import { category, categoryRule, db } from "@gp/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { Disclosure } from "@/components/ui/disclosure";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import {
  archiveCategoryAction,
  createCategoryAction,
  createRuleAction,
  deleteRuleAction,
  mergeCategoryAction,
  restoreCategoryAction,
} from "@/server/actions/money";
import { ensureDefaultCategories } from "@/server/finance/defaults";

export const metadata: Metadata = { title: "Categorías" };

const KLASS = { essential: "Esencial", lifestyle: "Estilo de vida", savings: "Ahorro y deuda" } as const;

export default async function CategoriesPage() {
  const { user } = await requireUser();
  await ensureDefaultCategories(user.id);
  const [all, rules] = await Promise.all([
    db.select().from(category).where(eq(category.userId, user.id)).orderBy(category.sortOrder, category.name),
    db.select().from(categoryRule).where(eq(categoryRule.userId, user.id)).orderBy(categoryRule.pattern),
  ]);
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

      <div className="mt-4 flex flex-wrap gap-3">
        <Disclosure label="Fusionar dos categorías" className="w-full">
          <GlassCard interactive={false} className="p-6 md:p-8">
            <ActionForm action={mergeCategoryAction} closeOnOk className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
              <div>
                <label htmlFor="mg-src" className="block text-[12px] text-haze">
                  Esta categoría…
                </label>
                <select id="mg-src" name="sourceId" defaultValue="" className="field mt-1.5">
                  <option value="" disabled>
                    Elige
                  </option>
                  <CategoryOptions list={active} />
                </select>
              </div>
              <div>
                <label htmlFor="mg-dst" className="block text-[12px] text-haze">
                  …pasa a ser parte de
                </label>
                <select id="mg-dst" name="targetId" defaultValue="" className="field mt-1.5">
                  <option value="" disabled>
                    Elige
                  </option>
                  <CategoryOptions list={active} />
                </select>
              </div>
              <SubmitButton variant="danger">Fusionar</SubmitButton>
              <p className="text-[12px] text-haze sm:col-span-3">Todos sus movimientos y reglas pasan a la segunda. La primera desaparece.</p>
            </ActionForm>
          </GlassCard>
        </Disclosure>
      </div>

      <section className="mt-12">
        <h2 className="eyebrow">Reglas automáticas</h2>
        <p className="mt-2 max-w-xl text-[14px] text-mist">
          Si registras un gasto sin categoría, se elige sola según el comercio. Las reglas aprendidas salen de lo que tú eliges.
        </p>
        <GlassCard interactive={false} className="mt-4 p-6">
          <ActionForm action={createRuleAction} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="rl-pattern" className="block text-[12px] text-haze">
                Si el comercio contiene
              </label>
              <input id="rl-pattern" name="pattern" placeholder="oxxo" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="rl-cat" className="block text-[12px] text-haze">
                Usar la categoría
              </label>
              <select id="rl-cat" name="categoryId" defaultValue="" className="field mt-1.5">
                <option value="" disabled>
                  Elige
                </option>
                <CategoryOptions list={active} />
              </select>
            </div>
            <SubmitButton>Agregar regla</SubmitButton>
          </ActionForm>
          {rules.length ? (
            <ul className="mt-6 grid gap-2">
              {rules.map((r) => {
                const c = all.find((x) => x.id === r.categoryId);
                return (
                  <li key={r.id} className="flex items-center gap-3 rounded-xl bg-white/[.03] px-4 py-2.5 text-[14px] ring-1 ring-white/[.06]">
                    <span className="font-mono text-[13px]">{r.pattern}</span>
                    <span className="text-haze">→</span>
                    <span className="min-w-0 flex-1 truncate">{c ? `${c.emoji} ${c.name}` : "—"}</span>
                    <span className="text-[11px] text-haze">{r.origin === "manual" ? "manual" : "aprendida"}</span>
                    <ActionButton action={deleteRuleAction} fields={{ id: r.id }} className="!px-3">
                      Quitar
                    </ActionButton>
                  </li>
                );
              })}
            </ul>
          ) : null}
        </GlassCard>
      </section>

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

/** Opciones agrupadas por tipo (gastos e ingresos no se mezclan). */
function CategoryOptions({ list }: { list: { id: string; name: string; emoji: string; kind: "expense" | "income" }[] }) {
  return (
    <>
      {(["expense", "income"] as const).map((kind) => (
        <optgroup key={kind} label={kind === "expense" ? "Gastos" : "Ingresos"}>
          {list
            .filter((c) => c.kind === kind)
            .map((c) => (
              <option key={c.id} value={c.id}>{`${c.emoji} ${c.name}`}</option>
            ))}
        </optgroup>
      ))}
    </>
  );
}
