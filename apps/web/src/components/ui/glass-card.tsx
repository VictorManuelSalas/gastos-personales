"use client";

import { useRef, type HTMLAttributes, type PointerEvent } from "react";

type Props = HTMLAttributes<HTMLElement> & {
  /** Escala, filo brillante y luz que sigue al cursor. */
  interactive?: boolean;
  as?: "div" | "article" | "section" | "li";
};

export function GlassCard({ interactive = true, as = "div", className = "", onPointerMove, ...rest }: Props) {
  const ref = useRef<HTMLElement>(null);
  // Todas las etiquetas permitidas comparten la interfaz de HTMLElement.
  const Tag = as as "div";

  function handleMove(e: PointerEvent<HTMLElement>) {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      el.style.setProperty("--mx", `${e.clientX - r.left}px`);
      el.style.setProperty("--my", `${e.clientY - r.top}px`);
    }
    onPointerMove?.(e);
  }

  return (
    <Tag
      ref={ref as React.Ref<HTMLDivElement>}
      onPointerMove={interactive ? handleMove : onPointerMove}
      className={`glass ${interactive ? "card" : ""} rounded-[28px] ${className}`}
      {...rest}
    />
  );
}
