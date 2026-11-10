import { TabBar, TopNav } from "@/components/app-nav";
import { UserMenu } from "@/components/user-menu";
import { Brand } from "@/components/ui/brand";
import { db, notification } from "@gp/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import Link from "next/link";
import { requireUser } from "@/lib/session";

export const dynamic = "force-dynamic";

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  const isAdmin = user.role === "admin";
  const [{ n: unread } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(notification)
    .where(and(eq(notification.userId, user.id), isNull(notification.readAt)));

  return (
    <div className="min-h-dvh pb-32 md:pb-16">
      <header className="gutter sticky z-40 pt-4" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-5 pr-2">
          <Brand href="/app" />
          <TopNav isAdmin={isAdmin} />
          <div className="flex items-center gap-1.5">
            <Link
              href="/app/avisos"
              aria-label={unread ? `${unread} avisos sin leer` : "Avisos"}
              className="relative grid h-9 w-9 place-items-center rounded-full text-mist transition-colors hover:bg-white/5 hover:text-ink"
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9M10.3 21a1.94 1.94 0 0 0 3.4 0" />
              </svg>
              {unread ? (
                <span className="num absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-rose px-1 text-[10px] font-semibold text-[#0d0e15]">
                  {unread > 9 ? "9+" : unread}
                </span>
              ) : null}
            </Link>
            <UserMenu name={user.name} email={user.email} initials={initials(user.name)} />
          </div>
        </div>
      </header>
      <main className="gutter mx-auto max-w-5xl pt-12 md:pt-16">{children}</main>
      <TabBar isAdmin={isAdmin} />
    </div>
  );
}
