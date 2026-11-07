"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: "home" | "invite" | "settings" };

const icons: Record<Item["icon"], React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  invite: (
    <>
      <path d="M15 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1" />
      <circle cx="9" cy="7.5" r="3.5" />
      <path d="M19 8v6M16 11h6" />
    </>
  ),
  settings: (
    <>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1Z" />
    </>
  ),
};

function Icon({ name }: { name: Item["icon"] }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {icons[name]}
    </svg>
  );
}

function useItems(isAdmin: boolean): Item[] {
  return [
    { href: "/app", label: "Inicio", icon: "home" },
    ...(isAdmin ? [{ href: "/app/invitaciones", label: "Invitaciones", icon: "invite" as const }] : []),
    { href: "/app/ajustes", label: "Ajustes", icon: "settings" },
  ];
}

const isActive = (pathname: string, href: string) => (href === "/app" ? pathname === "/app" : pathname.startsWith(href));

/** Navegación superior (escritorio). */
export function TopNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 md:flex">
      {useItems(isAdmin).map((it) => {
        const active = isActive(pathname, it.href);
        return (
          <Link
            key={it.href}
            href={it.href}
            className={`relative rounded-full px-4 py-2 text-[13px] transition-colors duration-200 ${active ? "text-ink" : "text-mist hover:text-ink"}`}
          >
            {active ? (
              <motion.span
                layoutId="topnav-pill"
                className="absolute inset-0 rounded-full bg-white/[.08] ring-1 ring-white/10"
                transition={{ type: "spring", stiffness: 420, damping: 36 }}
              />
            ) : null}
            <span className="relative">{it.label}</span>
          </Link>
        );
      })}
    </div>
  );
}

/** Barra de pestañas inferior (teléfono). */
export function TabBar({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  const items = useItems(isAdmin);
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{
        paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        paddingLeft: "max(16px, env(safe-area-inset-left))",
        paddingRight: "max(16px, env(safe-area-inset-right))",
      }}
      aria-label="Principal"
    >
      <div className="glass mx-auto flex max-w-sm items-center justify-around rounded-full p-1.5">
        {items.map((it) => {
          const active = isActive(pathname, it.href);
          return (
            <Link
              key={it.href}
              href={it.href}
              aria-current={active ? "page" : undefined}
              className={`btn relative flex-1 flex-col gap-0.5 rounded-full py-2 text-[10px] ${active ? "text-ink" : "text-haze"}`}
            >
              {active ? (
                <motion.span
                  layoutId="tabbar-pill"
                  className="absolute inset-0 rounded-full bg-white/[.09] ring-1 ring-white/10"
                  transition={{ type: "spring", stiffness: 420, damping: 36 }}
                />
              ) : null}
              <span className="relative">
                <Icon name={it.icon} />
              </span>
              <span className="relative">{it.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
