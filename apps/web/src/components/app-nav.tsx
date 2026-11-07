"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Item = { href: string; label: string; icon: "home" | "card" | "list" | "goal" | "more"; match?: string[] };

const icons: Record<Item["icon"], React.ReactNode> = {
  home: <path d="M4 10.5 12 4l8 6.5V20a1 1 0 0 1-1 1h-4.5v-6h-5v6H5a1 1 0 0 1-1-1v-9.5Z" />,
  card: (
    <>
      <rect x="2.5" y="5" width="19" height="14" rx="2.5" />
      <path d="M2.5 10h19M6.5 15h4" />
    </>
  ),
  list: <path d="M8 6h12M8 12h12M8 18h12M4 6h.01M4 12h.01M4 18h.01" />,
  goal: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <circle cx="12" cy="12" r="4.5" />
      <circle cx="12" cy="12" r="1" />
    </>
  ),
  more: (
    <>
      <circle cx="5" cy="12" r="1.3" />
      <circle cx="12" cy="12" r="1.3" />
      <circle cx="19" cy="12" r="1.3" />
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

function useItems(_isAdmin: boolean): Item[] {
  return [
    { href: "/app", label: "Inicio", icon: "home" },
    { href: "/app/tarjetas", label: "Tarjetas", icon: "card" },
    { href: "/app/movimientos", label: "Movimientos", icon: "list" },
    { href: "/app/metas", label: "Metas", icon: "goal" },
    {
      href: "/app/mas",
      label: "Más",
      icon: "more",
      match: ["/app/analisis", "/app/simulador", "/app/cuentas", "/app/ingresos", "/app/categorias", "/app/importar", "/app/me-deben", "/app/invitaciones", "/app/ajustes"],
    },
  ];
}

const isActive = (pathname: string, it: Item) =>
  it.href === "/app" ? pathname === "/app" : pathname.startsWith(it.href) || Boolean(it.match?.some((m) => pathname.startsWith(m)));

/** Navegación superior (escritorio). */
export function TopNav({ isAdmin }: { isAdmin: boolean }) {
  const pathname = usePathname();
  return (
    <div className="hidden items-center gap-1 md:flex">
      {useItems(isAdmin).map((it) => {
        const active = isActive(pathname, it);
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
      <div className="glass mx-auto flex max-w-md items-center justify-around rounded-full p-1.5">
        {items.map((it) => {
          const active = isActive(pathname, it);
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
