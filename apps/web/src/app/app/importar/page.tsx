import type { Metadata } from "next";
import { ImportWizard } from "@/components/finance/import-wizard";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Importar Excel" };

export default async function ImportPage() {
  await requireUser();
  return (
    <div>
      <PageHeader eyebrow="Importar" title="Trae tu historial.">
        Sube el Excel donde llevas tus tarjetas. Deducimos el día de corte y la regla de pago de cada una con tus propias fechas, y
        cargamos tus montos y compras a meses.
      </PageHeader>
      <div className="rise d2 mt-6 flex flex-wrap items-center gap-3">
        <a href="/api/import-template" download className="btn btn-ghost rounded-full px-5 py-2.5 text-[14px]">
          Descargar Excel de ejemplo
        </a>
        <span className="text-[13px] text-haze">Úsalo como guía: cambia los datos de ejemplo por los tuyos y súbelo aquí.</span>
      </div>
      <GlassCard interactive={false} className="rise d3 mt-12 p-6 md:p-9">
        <ImportWizard />
      </GlassCard>
    </div>
  );
}
