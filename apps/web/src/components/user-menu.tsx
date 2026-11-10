"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOutAction } from "@/app/(auth)/actions";

/** Avatar del encabezado: al tocarlo muestra el nombre, Ajustes y Cerrar sesión. */
export function UserMenu({ name, email, initials }: { name: string; email: string; initials: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        aria-haspopup="menu"
        aria-label="Menú de tu cuenta"
        className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-[13px] font-semibold ring-1 ring-white/10 transition-colors hover:bg-white/10"
      >
        {initials}
      </button>
      {open ? (
        <div role="menu" className="absolute right-0 top-full mt-3 w-60 rounded-2xl bg-[#1d1f2b] p-1.5 shadow-2xl ring-1 ring-white/10">
          <div className="px-3 py-2.5">
            <p className="truncate text-[14px] font-medium">{name}</p>
            <p className="truncate text-[12px] text-haze">{email}</p>
          </div>
          <div className="my-1 border-t border-white/[.06]" />
          <Link href="/app/ajustes" role="menuitem" className="block rounded-xl px-3 py-2.5 text-[14px] text-mist transition-colors hover:bg-white/5 hover:text-ink">
            Ajustes
          </Link>
          <form action={signOutAction}>
            <button type="submit" role="menuitem" className="w-full rounded-xl px-3 py-2.5 text-left text-[14px] text-rose transition-colors hover:bg-white/5">
              Cerrar sesión
            </button>
          </form>
        </div>
      ) : null}
    </div>
  );
}
