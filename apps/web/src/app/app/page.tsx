import type { Metadata } from "next";
import { InstallCard } from "@/components/install-card";
import { GlassCard } from "@/components/ui/glass-card";
import { formatLongDate, greeting, nextPayday } from "@/lib/dates";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Inicio" };

const phases = [
  { n: 0, name: "Base", body: "Cuentas por invitación, app instalable y servidor en casa.", state: "now" },
  { n: 1, name: "Núcleo", body: "Tarjetas, ciclos, quincenas, MSI, categorías e importador del Excel.", state: "next" },
  { n: 2, name: "Hábitos", body: "Bot de Telegram, metas, avisos, salud financiera y Me deben.", state: "later" },
  { n: 3, name: "Extras", body: "Lista de deseos, espacios compartidos y patrimonio.", state: "later" },
] as const;

export default async function HomePage() {
  const { user } = await requireUser();
  const firstName = user.name.split(/\s+/)[0];
  const pay = nextPayday();
  const payLabel =
    pay.daysUntil === 0 ? "Hoy es día de cobro" : pay.daysUntil === 1 ? "Mañana cobras" : `Faltan ${pay.daysUntil} días`;

  return (
    <div>
      <section>
        <p className="eyebrow rise">{greeting()}</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.8rem,8vw,6rem)] font-semibold leading-[0.92] tracking-tighter">
          <span className="chrome">Hola, {firstName}.</span>
        </h1>
        <p className="rise d2 mt-6 max-w-xl text-lg leading-relaxed text-mist">
          La base está lista. En la siguiente fase aquí vivirá tu quincena: lo que entra, lo que se va y lo que te queda.
        </p>
      </section>

      <div className="mt-14 grid auto-rows-[minmax(200px,auto)] grid-cols-1 gap-4 md:grid-cols-6">
        <GlassCard as="article" className="rise d2 p-7 md:col-span-4 md:p-9">
          <p className="eyebrow">Próximo cobro</p>
          <p className="num mt-5 text-[clamp(2.6rem,6vw,4.2rem)] font-semibold leading-none tracking-tighter chrome">
            {payLabel}
          </p>
          <p className="mt-4 text-[15px] text-mist first-letter:uppercase">{formatLongDate(pay.date)}</p>
          <p className="mt-8 max-w-md text-[14px] leading-relaxed text-haze">
            Días de pago: el 15 y el último día de cada mes. En la Fase 1 cada tarjeta se acomodará sola en la quincena
            que la paga.
          </p>
        </GlassCard>

        <div className="rise d3 md:col-span-2">
          <InstallCard />
        </div>

        <GlassCard as="article" className="rise d3 p-7 md:col-span-2">
          <p className="eyebrow">Telegram</p>
          <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">Escribe como hablas.</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-mist">
            Pronto bastará con mandar <span className="font-mono text-ink">café 65 nu</span> para registrar un gasto.
          </p>
          <p className="mt-6 text-[12px] text-haze">Llega en la Fase 2</p>
        </GlassCard>

        <GlassCard as="article" className="rise d4 p-7 md:col-span-4">
          <p className="eyebrow">Fases</p>
          <ol className="mt-5 grid gap-3 sm:grid-cols-2">
            {phases.map((p) => (
              <li
                key={p.n}
                className={`rounded-2xl p-4 ring-1 ${p.state === "now" ? "bg-glow/[.08] ring-glow/30" : "bg-white/[.03] ring-white/[.06]"}`}
              >
                <div className="flex items-center justify-between">
                  <span className={`font-mono text-[12px] ${p.state === "now" ? "text-glow" : "text-haze"}`}>
                    Fase {p.n} · {p.name}
                  </span>
                  {p.state === "now" ? (
                    <span className="rounded-full bg-glow/15 px-2 py-0.5 text-[10px] text-glow">En curso</span>
                  ) : p.state === "next" ? (
                    <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-haze">Siguiente</span>
                  ) : null}
                </div>
                <p className="mt-2 text-[13px] leading-relaxed text-mist">{p.body}</p>
              </li>
            ))}
          </ol>
        </GlassCard>
      </div>
    </div>
  );
}
