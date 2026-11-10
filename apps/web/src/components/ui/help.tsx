"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

const MARGIN = 16;
const MAX_WIDTH = 416;

/** Botón «?» que despliega una explicación corta de la pantalla. */
export function Help({ title, items }: { title: string; items: string[] }) {
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const open = pos !== null;

  function toggle() {
    if (open) return setPos(null);
    const r = buttonRef.current!.getBoundingClientRect();
    const width = Math.min(MAX_WIDTH, window.innerWidth - MARGIN * 2);
    const left = Math.min(Math.max(MARGIN, r.left), window.innerWidth - width - MARGIN);
    setPos({ top: r.bottom + 12, left, width });
  }

  useEffect(() => {
    if (!open) return;
    const close = () => setPos(null);
    const onDown = (e: PointerEvent) => {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !buttonRef.current?.contains(t)) close();
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && close();
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", close, { passive: true });
    window.addEventListener("resize", close);
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", close);
      window.removeEventListener("resize", close);
    };
  }, [open]);

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-label={`Ayuda: ${title}`}
        className="grid h-6 w-6 place-items-center rounded-full bg-white/5 text-[12px] font-semibold text-mist ring-1 ring-white/10 transition-colors hover:bg-white/10 hover:text-ink"
      >
        ?
      </button>
      {/* En el body: las animaciones de entrada de la página crean capas que lo taparían. */}
      {pos
        ? createPortal(
            <div
              ref={panelRef}
              role="dialog"
              aria-label={title}
              style={{ top: pos.top, left: pos.left, width: pos.width }}
              className="fixed z-50 max-h-[70dvh] overflow-y-auto rounded-2xl bg-[#1d1f2b] p-5 shadow-2xl ring-1 ring-white/10"
            >
              <p className="text-[15px] font-semibold text-ink">{title}</p>
              <ul className="mt-3 grid gap-2.5 text-[14px] leading-relaxed text-mist">
                {items.map((t) => (
                  <li key={t} className="flex gap-2.5">
                    <span className="mt-[9px] h-1 w-1 shrink-0 rounded-full bg-glow" aria-hidden="true" />
                    <span>{t}</span>
                  </li>
                ))}
              </ul>
            </div>,
            document.body,
          )
        : null}
    </>
  );
}
