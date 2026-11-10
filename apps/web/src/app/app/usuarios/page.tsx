import { db, user } from "@gp/db";
import { asc } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { formatShortDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { blockUserAction, unblockUserAction } from "./actions";

export const metadata: Metadata = { title: "Usuarios" };

const badge = "rounded-full px-2.5 py-0.5 text-[11px] ring-1";

export default async function UsersPage() {
  const { user: me } = await requireAdmin();
  // Sin datos financieros: el administrador no ve las finanzas de nadie.
  const rows = await db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      lastLoginAt: user.lastLoginAt,
      blockedAt: user.blockedAt,
      telegram: user.telegramChatId,
    })
    .from(user)
    .orderBy(asc(user.createdAt));
  const active = rows.filter((r) => !r.blockedAt).length;

  return (
    <div>
      <section>
        <p className="eyebrow rise">Administración</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.95] tracking-tighter chrome">Quién usa Quincena.</h1>
        <p className="rise d2 mt-6 max-w-xl text-lg leading-relaxed text-mist">
          {active} {active === 1 ? "cuenta activa" : "cuentas activas"} de {rows.length}. Una cuenta bloqueada no puede entrar ni usar el bot; sus datos se
          conservan y vuelve a tenerlos al reactivarla.
        </p>
      </section>

      <ul className="mt-12 grid gap-3">
        {rows.map((r) => {
          const isMe = r.id === me.id;
          return (
            <GlassCard as="li" key={r.id} interactive={false} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="truncate text-[15px] font-medium">{r.name}</span>
                  {r.role === "admin" ? <span className={`${badge} bg-glow/10 text-glow ring-glow/25`}>Admin</span> : null}
                  {r.blockedAt ? (
                    <span className={`${badge} bg-rose/10 text-rose ring-rose/25`}>Bloqueada</span>
                  ) : (
                    <span className={`${badge} bg-mint/10 text-mint ring-mint/25`}>Activa</span>
                  )}
                  {isMe ? <span className="text-[12px] text-haze">Tú</span> : null}
                </div>
                <p className="mt-1 truncate text-[13px] text-mist">{r.email}</p>
                <p className="mt-1.5 text-[12px] text-haze">
                  Último acceso: {r.lastLoginAt ? formatShortDateTime(r.lastLoginAt) : "sin registro"} · Se unió {formatShortDateTime(r.createdAt)}
                  {r.telegram ? " · Telegram conectado" : ""}
                  {r.blockedAt ? ` · Bloqueada ${formatShortDateTime(r.blockedAt)}` : ""}
                </p>
              </div>
              {isMe || r.role === "admin" ? null : r.blockedAt ? (
                <ActionButton action={unblockUserAction} fields={{ id: r.id }} variant="primary" pending="Reactivando…">
                  Reactivar
                </ActionButton>
              ) : (
                <ActionButton action={blockUserAction} fields={{ id: r.id }} variant="danger" pending="Bloqueando…">
                  Bloquear acceso
                </ActionButton>
              )}
            </GlassCard>
          );
        })}
      </ul>
    </div>
  );
}
