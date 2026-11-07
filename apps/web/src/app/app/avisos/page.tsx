import { db, notification } from "@gp/db";
import { desc, eq } from "drizzle-orm";
import type { Metadata } from "next";
import { ActionButton } from "@/components/ui/action-form";
import { EmptyState, PageHeader } from "@/components/ui/page-header";
import { formatShortDateTime } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import { markAllReadAction } from "@/server/actions/notifications";
import { plain } from "@/server/notify/push";

export const metadata: Metadata = { title: "Avisos" };

export default async function InboxPage() {
  const { user } = await requireUser();
  const items = await db.select().from(notification).where(eq(notification.userId, user.id)).orderBy(desc(notification.createdAt)).limit(80);
  const unread = items.filter((i) => !i.readAt).length;
  return (
    <div>
      <PageHeader eyebrow="Avisos" title={unread ? `${unread} sin leer` : "Al día."}>
        Todo lo que te avisamos por Telegram o como notificación también queda aquí.
      </PageHeader>
      {unread ? (
        <div className="mt-8">
          <ActionButton action={markAllReadAction} fields={{}}>
            Marcar todo como leído
          </ActionButton>
        </div>
      ) : null}
      <ul className="mt-8 grid gap-2">
        {items.length === 0 ? <EmptyState title="Sin avisos todavía">Aquí aparecerán fechas límite, cortes, metas y resúmenes.</EmptyState> : null}
        {items.map((n) => (
          <li key={n.id} className={`rounded-2xl px-4 py-3 ring-1 ${n.readAt ? "bg-white/[.02] ring-white/[.05]" : "bg-glow/[.06] ring-glow/20"}`}>
            <p className="whitespace-pre-line text-[14px] leading-relaxed">{plain(n.body)}</p>
            <p className="mt-1 text-[11px] text-haze">
              {formatShortDateTime(n.createdAt)}
              {n.error ? ` · no se pudo enviar (${n.error})` : ""}
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}
