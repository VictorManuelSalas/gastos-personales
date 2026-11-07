import { TabBar, TopNav } from "@/components/app-nav";
import { Brand } from "@/components/ui/brand";
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

  return (
    <div className="min-h-dvh pb-32 md:pb-16">
      <header className="gutter sticky z-40 pt-4" style={{ top: "env(safe-area-inset-top, 0px)" }}>
        <div className="glass mx-auto flex max-w-5xl items-center justify-between rounded-full py-2 pl-5 pr-2">
          <Brand href="/app" />
          <TopNav isAdmin={isAdmin} />
          <span
            className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-[13px] font-semibold ring-1 ring-white/10"
            title={user.name}
          >
            {initials(user.name)}
          </span>
        </div>
      </header>
      <main className="gutter mx-auto max-w-5xl pt-12 md:pt-16">{children}</main>
      <TabBar isAdmin={isAdmin} />
    </div>
  );
}
