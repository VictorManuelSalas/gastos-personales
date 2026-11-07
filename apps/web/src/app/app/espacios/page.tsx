import { formatMXN } from "@gp/core";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { createSpaceAction } from "@/server/actions/spaces";
import { mySpaces } from "@/server/finance/spaces";

export const metadata: Metadata = { title: "Espacios compartidos" };

export default async function SpacesPage() {
  const { user } = await requireUser();
  const spaces = await mySpaces(user.id);
  return (
    <div>
      <PageHeader eyebrow="Espacios compartidos" title="Lo que se paga entre varios.">
        Servicios de la casa, un viaje con amigos o una meta familiar. Cada quien anota lo que pagó y la app calcula quién le debe a quién.
        Nadie ve tus finanzas personales.
      </PageHeader>

      <GlassCard interactive={false} className="rise d3 mt-10 p-6">
        <ActionForm action={createSpaceAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
          <div>
            <label htmlFor="sp-name" className="block text-[12px] text-haze">
              Nuevo espacio
            </label>
            <input id="sp-name" name="name" placeholder="Casa, Viaje a Cancún…" className="field mt-1.5" />
          </div>
          <SubmitButton>Crear</SubmitButton>
        </ActionForm>
      </GlassCard>

      <div className="mt-10 grid gap-4 md:grid-cols-2">
        {spaces.length === 0 ? (
          <div className="md:col-span-2">
            <EmptyState title="Sin espacios">Crea uno y agrega a quien comparte gastos contigo (necesita cuenta en este servidor).</EmptyState>
          </div>
        ) : null}
        {spaces.map((s) => (
          <Link key={s.id} href={`/app/espacios/${s.id}`} className="block">
            <GlassCard as="article" className="h-full p-6">
              <h2 className="text-xl font-semibold tracking-tight">{s.name}</h2>
              <p className="mt-1 text-[13px] text-haze">{s.members} miembros</p>
              <p className={`num mt-5 text-[22px] font-semibold tracking-tight ${s.myBalance > 0 ? "text-mint" : s.myBalance < 0 ? "text-amber" : ""}`}>
                {s.myBalance > 0 ? `Te deben ${formatMXN(s.myBalance)}` : s.myBalance < 0 ? `Debes ${formatMXN(-s.myBalance)}` : "Están a mano"}
              </p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
