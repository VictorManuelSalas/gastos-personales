import { db, invitation, user } from "@gp/db";
import { desc, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Metadata } from "next";
import { GlassCard } from "@/components/ui/glass-card";
import { formatShortDateTime } from "@/lib/dates";
import { requireAdmin } from "@/lib/session";
import { revokeInvitationAction } from "./actions";
import { CopyButton } from "./copy-button";
import { InviteForm } from "./invite-form";

export const metadata: Metadata = { title: "Invitaciones" };

const usedBy = alias(user, "used_by_user");

type Status = "active" | "used" | "expired";
const statusStyle: Record<Status, { label: string; cls: string }> = {
  active: { label: "Activa", cls: "bg-mint/10 text-mint ring-mint/25" },
  used: { label: "Usada", cls: "bg-white/5 text-mist ring-white/10" },
  expired: { label: "Vencida", cls: "bg-amber/10 text-amber ring-amber/25" },
};

export default async function InvitationsPage() {
  await requireAdmin();
  const appUrl = process.env.BETTER_AUTH_URL ?? "http://localhost:3100";
  const now = new Date();

  const rows = await db
    .select({
      id: invitation.id,
      token: invitation.token,
      email: invitation.email,
      note: invitation.note,
      usedAt: invitation.usedAt,
      expiresAt: invitation.expiresAt,
      createdAt: invitation.createdAt,
      usedByName: usedBy.name,
    })
    .from(invitation)
    .leftJoin(usedBy, eq(invitation.usedBy, usedBy.id))
    .orderBy(desc(invitation.createdAt))
    .limit(50);

  return (
    <div>
      <section>
        <p className="eyebrow rise">Administración</p>
        <h1 className="rise d1 mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.95] tracking-tighter chrome">
          Invita a los tuyos.
        </h1>
        <p className="rise d2 mt-6 max-w-xl text-lg leading-relaxed text-mist">
          Cada enlace sirve una sola vez y dura 7 días. Quien entre tendrá su propio espacio; tú no podrás ver sus
          finanzas.
        </p>
      </section>

      <GlassCard interactive={false} className="rise d2 mt-12 p-6 md:p-8">
        <InviteForm />
      </GlassCard>

      <section className="mt-10">
        <h2 className="eyebrow">Enlaces generados</h2>
        {rows.length === 0 ? (
          <GlassCard interactive={false} className="mt-4 p-8 text-center">
            <p className="text-[15px] text-mist">Aún no hay invitaciones. Genera la primera arriba.</p>
          </GlassCard>
        ) : (
          <ul className="mt-4 grid gap-3">
            {rows.map((r) => {
              const status: Status = r.usedAt ? "used" : r.expiresAt < now ? "expired" : "active";
              const link = `${appUrl}/registro?invitacion=${r.token}`;
              return (
                <GlassCard as="li" key={r.id} className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2.5 py-0.5 text-[11px] ring-1 ${statusStyle[status].cls}`}>
                        {statusStyle[status].label}
                      </span>
                      <span className="truncate text-[15px] font-medium">{r.note ?? r.email ?? "Invitación abierta"}</span>
                    </div>
                    <p className="mt-1.5 text-[12px] text-haze">
                      {status === "used"
                        ? `Usada por ${r.usedByName ?? "alguien"} · ${formatShortDateTime(r.usedAt!)}`
                        : status === "expired"
                          ? `Venció ${formatShortDateTime(r.expiresAt)}`
                          : `Vence ${formatShortDateTime(r.expiresAt)}${r.email ? ` · solo ${r.email}` : ""}`}
                    </p>
                  </div>
                  {status === "active" ? (
                    <div className="flex shrink-0 gap-2">
                      <CopyButton text={link} />
                      <form action={revokeInvitationAction}>
                        <input type="hidden" name="id" value={r.id} />
                        <button type="submit" className="btn btn-danger rounded-full px-4 py-2 text-[13px]">
                          Revocar
                        </button>
                      </form>
                    </div>
                  ) : null}
                </GlassCard>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
