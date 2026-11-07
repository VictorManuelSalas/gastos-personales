import { centsToInput, formatMXN, wishReady } from "@gp/core";
import { creditLine, db, wishlistItem } from "@gp/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import type { Metadata } from "next";
import Link from "next/link";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { requireUser } from "@/lib/session";
import { addWishAction, decideWishAction } from "@/server/actions/wishlist";

export const metadata: Metadata = { title: "Lista de deseos" };

function remaining(at: Date) {
  const ms = at.getTime() - Date.now();
  const h = Math.ceil(ms / 3_600_000);
  return h >= 24 ? `${Math.ceil(h / 24)} ${Math.ceil(h / 24) === 1 ? "día" : "días"}` : `${h} h`;
}

export default async function WishlistPage() {
  const { user } = await requireUser();
  const [items, lines] = await Promise.all([
    db.select().from(wishlistItem).where(eq(wishlistItem.userId, user.id)).orderBy(desc(wishlistItem.createdAt)),
    db.select().from(creditLine).where(and(eq(creditLine.userId, user.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
  ]);
  const waiting = items.filter((i) => i.status === "waiting");
  const dropped = items.filter((i) => i.status === "dropped");
  const saved = dropped.reduce((s, i) => s + i.priceCents, 0);

  return (
    <div>
      <PageHeader eyebrow="Lista de deseos" title="Espera 72 horas.">
        Lo que quieres comprar se guarda aquí tres días. Si después lo sigues queriendo y el simulador dice que alcanza, adelante.
      </PageHeader>

      {saved > 0 ? (
        <p className="rise d2 mt-6 text-[15px] text-mint num">Has dejado pasar {dropped.length} compras: {formatMXN(saved, { round: true })} que siguen en tu bolsa.</p>
      ) : null}

      <GlassCard interactive={false} className="rise d3 mt-10 p-6 md:p-8">
        <ActionForm action={addWishAction} className="grid gap-4 sm:grid-cols-[1.4fr_1fr_120px_1fr_auto] sm:items-end">
          <div>
            <label htmlFor="ws-product" className="block text-[12px] text-haze">
              ¿Qué quieres?
            </label>
            <input id="ws-product" name="product" placeholder="Audífonos" className="field mt-1.5" />
          </div>
          <div>
            <label htmlFor="ws-price" className="block text-[12px] text-haze">
              Precio
            </label>
            <input id="ws-price" name="price" inputMode="decimal" placeholder="2500" className="field num mt-1.5" />
          </div>
          <div>
            <label htmlFor="ws-months" className="block text-[12px] text-haze">
              Meses
            </label>
            <select id="ws-months" name="months" defaultValue="1" className="field mt-1.5">
              {[1, 3, 6, 12, 18].map((m) => (
                <option key={m} value={m}>
                  {m === 1 ? "Contado" : `${m} MSI`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ws-line" className="block text-[12px] text-haze">
              Tarjeta
            </label>
            <select id="ws-line" name="lineId" defaultValue="" className="field mt-1.5">
              <option value="">Sin decidir</option>
              {lines.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>
          <SubmitButton>Guardar</SubmitButton>
        </ActionForm>
      </GlassCard>

      <section className="mt-10">
        <h2 className="eyebrow">Esperando</h2>
        {waiting.length === 0 ? (
          <div className="mt-4">
            <EmptyState title="Nada en espera">Cuando se te antoje algo, guárdalo aquí o con el bot: /deseo audífonos 2500.</EmptyState>
          </div>
        ) : (
          <ul className="mt-4 grid gap-3 md:grid-cols-2">
            {waiting.map((i) => {
              const ready = wishReady(i.availableAt);
              const sim = new URLSearchParams({
                producto: i.product,
                precio: centsToInput(i.priceCents),
                meses: String(i.months),
                ...(i.creditLineId ? { tarjeta: i.creditLineId } : lines[0] ? { tarjeta: lines[0].id } : {}),
              });
              return (
                <GlassCard as="li" key={i.id} interactive={false} className="p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0">
                      <p className="truncate text-[16px] font-medium">{i.product}</p>
                      <p className="num mt-1 text-[13px] text-mist">
                        {formatMXN(i.priceCents)}
                        {i.months > 1 ? ` a ${i.months} MSI` : ""}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-0.5 text-[11px] ring-1 ${ready ? "bg-mint/10 text-mint ring-mint/25" : "bg-white/5 text-haze ring-white/10"}`}>
                      {ready ? "Ya puedes decidir" : `Faltan ${remaining(i.availableAt)}`}
                    </span>
                  </div>
                  {ready ? (
                    <div className="mt-4 flex flex-wrap gap-2">
                      <p className="w-full text-[13px] text-mist">¿Todavía lo quieres?</p>
                      <Link href={`/app/simulador?${sim}`} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
                        ¿Me alcanza?
                      </Link>
                      <ActionButton action={decideWishAction} fields={{ id: i.id, decision: "bought" }}>
                        Lo compré
                      </ActionButton>
                      <ActionButton action={decideWishAction} fields={{ id: i.id, decision: "dropped" }} variant="primary">
                        Ya no lo quiero
                      </ActionButton>
                    </div>
                  ) : (
                    <div className="mt-4 flex gap-2">
                      <ActionButton action={decideWishAction} fields={{ id: i.id, decision: "dropped" }}>
                        Ya no lo quiero
                      </ActionButton>
                    </div>
                  )}
                </GlassCard>
              );
            })}
          </ul>
        )}
      </section>

      {items.some((i) => i.status !== "waiting") ? (
        <section className="mt-10">
          <h2 className="eyebrow">Decididos</h2>
          <ul className="mt-4 grid gap-2">
            {items
              .filter((i) => i.status !== "waiting")
              .slice(0, 20)
              .map((i) => (
                <li key={i.id} className="flex items-center justify-between rounded-2xl bg-white/[.03] px-4 py-3 text-[14px] ring-1 ring-white/[.06]">
                  <span className={i.status === "dropped" ? "text-mist line-through decoration-white/20" : ""}>{i.product}</span>
                  <span className="num text-[13px] text-haze">
                    {formatMXN(i.priceCents)} · {i.status === "bought" ? "comprado" : "lo dejaste pasar"}
                  </span>
                </li>
              ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
