import type { Metadata } from "next";
import { signOutAction } from "@/app/(auth)/actions";
import { GlassCard } from "@/components/ui/glass-card";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Ajustes" };

export default async function SettingsPage() {
  const { user } = await requireUser();

  const rows: [string, string][] = [
    ["Nombre", user.name],
    ["Correo", user.email],
    ["Rol", user.role === "admin" ? "Administrador" : "Usuario"],
    ["Días de cobro", "15 y último día del mes"],
    ["Zona horaria", "Ciudad de México"],
  ];

  return (
    <div>
      <section>
        <p className="eyebrow rise">Ajustes</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.95] tracking-tighter chrome">
          Tu cuenta.
        </h1>
      </section>

      <GlassCard interactive={false} className="rise d2 mt-12 divide-y divide-white/[.06] p-2">
        {rows.map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 px-5 py-4 text-[15px]">
            <span className="text-mist">{k}</span>
            <span className="min-w-0 truncate text-right">{v}</span>
          </div>
        ))}
      </GlassCard>

      <p className="mt-4 px-1 text-[13px] text-haze">
        En las siguientes fases aquí configurarás tus días de cobro, notificaciones y la conexión con Telegram.
      </p>

      <form action={signOutAction} className="rise d3 mt-10">
        <button type="submit" className="btn btn-danger w-full rounded-xl py-3.5 text-[15px] sm:w-auto sm:px-8">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
