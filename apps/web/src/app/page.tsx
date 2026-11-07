import Link from "next/link";
import { Brand } from "@/components/ui/brand";
import { GlassCard } from "@/components/ui/glass-card";
import { getSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const features = [
  {
    eyebrow: "Ciclos automáticos",
    title: "Cada corte se escribe solo.",
    body: "Registras la tarjeta una vez. La fecha límite y la quincena que la paga se calculan cada mes.",
    span: "md:col-span-4",
  },
  {
    eyebrow: "Telegram",
    title: "Escribe como hablas.",
    body: "café 65 nu. Listo, registrado.",
    span: "md:col-span-2",
  },
  {
    eyebrow: "Avisos",
    title: "Ninguna fecha se te escapa.",
    body: "Te avisamos antes de cada fecha límite, con el monto y la quincena de la que sale.",
    span: "md:col-span-3",
  },
  {
    eyebrow: "Metas",
    title: "Japón, una quincena a la vez.",
    body: "Aparta al cobrar y mira cómo se acerca lo que quieres.",
    span: "md:col-span-3",
  },
];

export default async function LandingPage() {
  const session = await getSession();
  const cta = session ? { href: "/app", label: "Ir a mi quincena" } : { href: "/entrar", label: "Entrar" };

  return (
    <div className="min-h-dvh">
      <header className="gutter sticky z-40 pt-4" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <nav className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-5 pr-2">
          <Brand />
          <Link href={cta.href} className="btn btn-primary rounded-full px-4 py-2 text-[13px]">
            {cta.label}
          </Link>
        </nav>
      </header>

      <main>
        <section className="gutter pt-20 md:pt-28">
          <div className="mx-auto max-w-5xl">
            <p className="eyebrow rise">Finanzas personales · solo para tu círculo</p>
            <h1 className="rise d1 mt-6 text-[clamp(3.2rem,10vw,7.6rem)] font-semibold leading-[0.9] tracking-tighter">
              <span className="chrome">Tu quincena.</span>
              <br />
              <span className="chrome-soft">Por fin, en claro.</span>
            </h1>
            <p className="rise d2 mt-8 max-w-xl text-[clamp(1.05rem,1.6vw,1.25rem)] leading-relaxed text-mist">
              Cada corte, cada fecha límite, cada café. Todo se acomoda solo en la quincena que le toca, para que sepas
              lo que de verdad te queda.
            </p>
            <div className="rise d3 mt-10 flex flex-wrap gap-3">
              <Link href={cta.href} className="btn btn-primary rounded-full px-6 py-3.5 text-[15px]">
                {cta.label}
              </Link>
              {!session ? (
                <Link href="/registro" className="btn btn-ghost rounded-full px-6 py-3.5 text-[15px]">
                  Tengo una invitación
                </Link>
              ) : null}
            </div>
          </div>
        </section>

        <section className="gutter py-28 md:py-36">
          <div className="mx-auto grid max-w-5xl auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
            {features.map((f) => (
              <GlassCard as="article" key={f.eyebrow} className={`p-7 md:p-9 ${f.span}`}>
                <p className="eyebrow">{f.eyebrow}</p>
                <h2 className="mt-4 max-w-md text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold leading-tight tracking-tight">
                  {f.title}
                </h2>
                <p className="mt-3 max-w-md text-mist">{f.body}</p>
              </GlassCard>
            ))}
          </div>
        </section>
      </main>

      <footer className="gutter border-t border-white/[.06] py-10 text-[12px] text-haze">
        <div className="mx-auto flex max-w-5xl flex-wrap justify-between gap-4">
          <span>Quincena</span>
          <span>Hecho en casa, para la familia.</span>
        </div>
      </footer>
    </div>
  );
}
