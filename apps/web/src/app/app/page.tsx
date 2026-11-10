import { addDays, diffDays, formatMXN, paydayOnOrBefore } from "@gp/core";
import { db, quincenaClose } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { CloseQuincena } from "@/components/finance/close-quincena";
import type { Metadata } from "next";
import Link from "next/link";
import { FlowRow } from "@/components/finance/flow-row";
import { toRows } from "@/components/finance/to-rows";
import { InstallCard } from "@/components/install-card";
import { GlassCard } from "@/components/ui/glass-card";
import { fmtLong, fmtShort, greeting } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { ensureDefaultCategories } from "@/server/finance/defaults";
import { loadFinance } from "@/server/finance/overview";

export const metadata: Metadata = { title: "Mis quincenas" };

export default async function HomePage() {
  const { user } = await requireUser();
  await ensureDefaultCategories(user.id);
  const f = await loadFinance(user.id);
  const firstName = user.name.split(/\s+/)[0];
  const [current, ...upcoming] = f.quincenas;
  const accounts = f.accounts.map((a) => ({ id: a.id, name: a.name, isDefault: a.isDefault }));

  const setup = [
    { done: f.accounts.length > 0, label: "Agrega tus cuentas y su saldo", href: "/app/cuentas" },
    { done: f.lines.length > 0, label: "Registra tus tarjetas o importa tu Excel", href: f.lines.length ? "/app/tarjetas" : "/app/importar" },
    { done: f.sources.length > 0, label: "Agrega tus ingresos", href: "/app/ingresos" },
  ];
  const ready = setup.every((s) => s.done);
  const nextIn = diffDays(f.now, current!.end) + 1;

  // Cierre de la quincena anterior: se ofrece los primeros 3 días de la nueva quincena.
  const prevPayday = paydayOnOrBefore(f.rule, addDays(current!.payday, -1));
  const [closed] = await db.select().from(quincenaClose).where(and(eq(quincenaClose.userId, user.id), eq(quincenaClose.payday, prevPayday)));
  const accountsCreatedBefore = f.accounts.some((a) => a.createdAt.toISOString().slice(0, 10) <= prevPayday);
  const offerClose = !closed && accountsCreatedBefore && diffDays(current!.payday, f.now) <= 3;

  return (
    <div>
      <section>
        <p className="eyebrow rise">
          {greeting()}, {firstName}
        </p>
        <h1 className="rise d1 mt-5 text-[clamp(1.1rem,2vw,1.25rem)] font-medium text-mist">
          Quincena del {fmtShort(current!.payday)} al {fmtShort(current!.end)}
        </h1>
        <p data-tour="disponible" className="rise d1 mt-3 text-[clamp(3.4rem,11vw,7.5rem)] font-semibold leading-[0.9] tracking-tighter num">
          <span className={current!.endCents < 0 ? "text-rose" : "chrome"}>{formatMXN(current!.endCents)}</span>
        </p>
        <p className="rise d2 mt-5 max-w-xl text-lg leading-relaxed text-mist">
          {current!.endCents < 0
            ? "Esta quincena no alcanza para todo lo pendiente. Revisa qué pago puedes mover."
            : `Es lo que te queda después de lo pendiente. Faltan ${nextIn} ${nextIn === 1 ? "día" : "días"} para el próximo cobro.`}
        </p>
        <dl data-tour="resumen" className="rise d3 mt-10 grid max-w-xl grid-cols-3 gap-6 border-t border-white/10 pt-6">
          <div>
            <dt className="eyebrow">{f.reservedCents > 0 ? "Disponible hoy" : "Saldo hoy"}</dt>
            <dd className="num mt-2 text-xl font-semibold tracking-tight">{formatMXN(current!.startCents, { round: true })}</dd>
          </div>
          <div>
            <dt className="eyebrow">Por entrar</dt>
            <dd className="num mt-2 text-xl font-semibold tracking-tight text-mint">{formatMXN(current!.inCents, { round: true })}</dd>
          </div>
          <div>
            <dt className="eyebrow">Por pagar</dt>
            <dd className="num mt-2 text-xl font-semibold tracking-tight">{formatMXN(current!.outCents, { round: true })}</dd>
          </div>
        </dl>
        {f.reservedCents > 0 ? (
          <p className="rise d3 mt-4 text-[13px] text-haze num">
            Tienes {formatMXN(f.reservedCents, { round: true })} apartados en metas; ya no cuentan como disponibles.
          </p>
        ) : null}
      </section>

      {offerClose ? <CloseQuincena payday={prevPayday} accounts={f.accounts.map((a) => ({ id: a.id, name: a.name, balanceCents: a.balanceCents }))} /> : null}

      {!ready ? (
        <GlassCard interactive={false} className="rise d3 mt-12 p-7 md:p-9">
          <p className="eyebrow">Para empezar</p>
          <h2 className="mt-4 text-2xl font-semibold tracking-tight">Tres pasos y tu quincena se calcula sola.</h2>
          <ol className="mt-6 grid gap-2">
            {setup.map((s, i) => (
              <li key={s.href}>
                <Link
                  href={s.href}
                  className="flex items-center gap-4 rounded-2xl bg-white/[.03] px-4 py-3.5 ring-1 ring-white/[.06] transition-colors duration-300 hover:bg-white/[.06]"
                >
                  <span
                    className={`grid h-7 w-7 shrink-0 place-items-center rounded-full font-mono text-[12px] ${s.done ? "bg-mint/15 text-mint" : "bg-white/5 text-haze"}`}
                  >
                    {s.done ? "✓" : i + 1}
                  </span>
                  <span className={s.done ? "text-mist line-through decoration-white/20" : ""}>{s.label}</span>
                  <span className="ml-auto text-haze" aria-hidden="true">
                    →
                  </span>
                </Link>
              </li>
            ))}
          </ol>
        </GlassCard>
      ) : null}

      <section data-tour="esta-quincena" className="mt-14">
        <div className="flex items-baseline justify-between">
          <h2 className="eyebrow">Esta quincena</h2>
          <span className="text-[12px] text-haze">hasta el {fmtLong(current!.end)}</span>
        </div>
        {current!.items.length ? (
          <ul className="mt-4 grid gap-2">
            {toRows(current!.items, f.now).map((r) => (
              <FlowRow key={r.id} item={r} accounts={accounts} today={f.now} />
            ))}
          </ul>
        ) : (
          <p className="mt-4 text-[14px] text-mist">No hay pagos ni cobros pendientes en esta quincena.</p>
        )}
      </section>

      <section data-tour="proximas" className="mt-14">
        <h2 className="eyebrow">Próximas quincenas</h2>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {upcoming.map((q) => (
            <GlassCard as="article" key={q.payday} className="p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-[13px] text-mist">Cobro {fmtShort(q.payday)}</p>
                  <p className={`num mt-2 text-[32px] font-semibold leading-none tracking-tighter ${q.endCents < 0 ? "text-rose" : ""}`}>
                    {formatMXN(q.endCents, { round: true })}
                  </p>
                </div>
                <div className="text-right text-[12px] text-haze num">
                  <p className="text-mint">+{formatMXN(q.inCents, { round: true })}</p>
                  <p className="mt-1">−{formatMXN(q.outCents, { round: true })}</p>
                </div>
              </div>
              {q.items.filter((i) => i.direction === "out").length ? (
                <ul className="mt-5 grid gap-1.5 text-[13px]">
                  {q.items
                    .filter((i) => i.direction === "out")
                    .map((i) => (
                      <li key={i.id} className="flex items-center gap-2.5">
                        <span className="h-1.5 w-1.5 rounded-full" style={{ background: i.ref?.color ?? "var(--color-glow)" }} />
                        <span className="truncate text-mist">{i.label}</span>
                        <span className="text-haze">· {fmtShort(i.date)}</span>
                        <span className="num ml-auto">{formatMXN(i.amountCents, { round: true })}</span>
                      </li>
                    ))}
                </ul>
              ) : (
                <p className="mt-5 text-[13px] text-haze">Sin pagos asignados.</p>
              )}
            </GlassCard>
          ))}
        </div>
      </section>

      <div className="mt-14 grid gap-4 md:grid-cols-3">
        <Link href="/app/analisis" className="block">
          <GlassCard as="article" className="h-full p-7">
            <p className="eyebrow">Análisis</p>
            <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">Tu salud, en semáforo.</h3>
            <p className="mt-3 text-[14px] leading-relaxed text-mist">En qué se va tu dinero, tus presupuestos y siete indicadores para saber cómo vas.</p>
          </GlassCard>
        </Link>
        <InstallCard />
        <GlassCard as="article" className="p-7">
          <p className="eyebrow">Telegram</p>
          <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">Escribe como hablas.</h3>
          <p className="mt-3 text-[14px] leading-relaxed text-mist">
            Manda <span className="font-mono text-ink">café 65 nu</span> al bot y queda registrado. Conéctalo en Más → Ajustes.
          </p>
        </GlassCard>
      </div>
    </div>
  );
}
