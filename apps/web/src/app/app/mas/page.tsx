import type { Metadata } from "next";
import Link from "next/link";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Más" };

export default async function MorePage() {
  const { user } = await requireUser();
  const links = [
    { href: "/app/cuentas", title: "Cuentas", body: "Débito, efectivo y ahorro. Su saldo es tu punto de partida." },
    { href: "/app/ingresos", title: "Ingresos", body: "Sueldos y cobros fijos, con lo que esperas y lo que realmente cae." },
    { href: "/app/me-deben", title: "Me deben", body: "Lo que prestaste y lo que te van abonando, persona por persona." },
    { href: "/app/importar", title: "Importar Excel", body: "Trae tus tarjetas, tu historial y tus compras a meses desde tu hoja." },
    { href: "/app/categorias", title: "Categorías", body: "En qué se va tu dinero. Crea, archiva y marca los antojos." },
    ...(user.role === "admin"
      ? [{ href: "/app/invitaciones", title: "Invitaciones", body: "Enlaces de un solo uso para tu familia." }]
      : []),
    { href: "/app/ajustes", title: "Ajustes", body: "Tu cuenta y cerrar sesión." },
  ];
  return (
    <div>
      <PageHeader eyebrow="Más" title="Todo lo demás." />
      <div className="mt-12 grid gap-4 md:grid-cols-2">
        {links.map((l) => (
          <Link key={l.href} href={l.href} className="block">
            <GlassCard as="article" className="h-full p-7">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold tracking-tight">{l.title}</h2>
                <span className="text-haze" aria-hidden="true">
                  →
                </span>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-mist">{l.body}</p>
            </GlassCard>
          </Link>
        ))}
      </div>
    </div>
  );
}
