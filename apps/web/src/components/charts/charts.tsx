"use client";

import { formatMXN } from "@gp/core";
import { useState } from "react";

/**
 * Gráficas de Quincena. Paleta validada para el tema oscuro (scripts del skill dataviz):
 * magnitud en un solo tono; clases 50/30/20 en orden fijo; estados solo para presupuestos.
 */
export const SERIES = "#6f8cf2";
export const CLASS_COLORS = { essential: "#6f8cf2", lifestyle: "#c27a38", savings: "#a477eb" } as const;
export const CLASS_LABELS = { essential: "Esencial", lifestyle: "Estilo de vida", savings: "Ahorro y deuda" } as const;

const fmt = (c: number) => formatMXN(c, { round: true });

/** Barras horizontales con etiqueta y valor; al pasar el cursor muestra el % del total. */
export function BarList({ items, total }: { items: { key: string; label: string; cents: number }[]; total: number }) {
  const max = Math.max(1, ...items.map((i) => i.cents));
  return (
    <ul className="grid gap-3">
      {items.map((i) => (
        <li key={i.key} className="group relative">
          <div className="flex items-baseline justify-between gap-3 text-[13px]">
            <span className="min-w-0 truncate text-mist">{i.label}</span>
            <span className="num shrink-0 text-ink">{fmt(i.cents)}</span>
          </div>
          <div className="mt-1.5 h-2 rounded-full bg-white/[.05]">
            <div className="h-full rounded-full transition-[width] duration-700 ease-apple" style={{ width: `${Math.max(2, (i.cents / max) * 100)}%`, background: SERIES }} />
          </div>
          <span className="num pointer-events-none absolute -top-7 right-0 rounded-lg bg-[#1d1f2b] px-2 py-1 text-[11px] text-ink opacity-0 ring-1 ring-white/10 transition-opacity duration-200 group-hover:opacity-100">
            {total > 0 ? Math.round((i.cents / total) * 100) : 0}% del mes
          </span>
        </li>
      ))}
    </ul>
  );
}

/** Tendencia mensual: barras verticales ancladas a la base, con tooltip por barra. */
export function TrendBars({ data, labels }: { data: { month: string; cents: number }[]; labels: string[] }) {
  const [hover, setHover] = useState<number | null>(null);
  const max = Math.max(1, ...data.map((d) => d.cents));
  const ticks = [0, 0.5, 1].map((t) => Math.round(max * t));
  const H = 160;
  return (
    <div className="relative">
      <div className="flex gap-3">
        <div className="num flex w-14 shrink-0 flex-col justify-between text-right text-[10px] text-haze" style={{ height: H }}>
          {[...ticks].reverse().map((t) => (
            <span key={t}>{fmt(t)}</span>
          ))}
        </div>
        <div className="relative flex flex-1 items-end gap-2" style={{ height: H }} onMouseLeave={() => setHover(null)}>
          {[0, 0.5, 1].map((t) => (
            <div key={t} className="pointer-events-none absolute inset-x-0 border-t border-white/[.05]" style={{ bottom: `${t * 100}%` }} />
          ))}
          {data.map((d, i) => {
            const last = i === data.length - 1;
            return (
              <button
                key={d.month}
                type="button"
                onMouseEnter={() => setHover(i)}
                onFocus={() => setHover(i)}
                onBlur={() => setHover(null)}
                aria-label={`${labels[i]}: ${fmt(d.cents)}`}
                className="relative flex h-full flex-1 items-end justify-center"
              >
                <span
                  className="block w-full max-w-10 rounded-t-[4px] transition-[height,opacity] duration-500 ease-apple"
                  style={{ height: `${Math.max(1.5, (d.cents / max) * 100)}%`, background: SERIES, opacity: hover == null || hover === i ? (last ? 1 : 0.7) : 0.35 }}
                />
                {hover === i ? (
                  <span className="num pointer-events-none absolute bottom-full z-10 mb-2 whitespace-nowrap rounded-lg bg-[#1d1f2b] px-2.5 py-1.5 text-[12px] text-ink ring-1 ring-white/10">
                    {labels[i]} · {fmt(d.cents)}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </div>
      <div className="ml-[68px] mt-2 flex gap-2">
        {labels.map((l, i) => (
          <span key={l + i} className={`flex-1 text-center text-[11px] ${i === labels.length - 1 ? "text-ink" : "text-haze"}`}>
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Reparto 50/30/20: una barra segmentada con 2px de separación, leyenda y etiquetas directas. */
export function ClassSplit({ data }: { data: { key: keyof typeof CLASS_COLORS; cents: number }[] }) {
  const total = data.reduce((s, d) => s + d.cents, 0);
  const [hover, setHover] = useState<string | null>(null);
  if (total === 0) return <p className="text-[13px] text-haze">Sin gastos categorizados este mes.</p>;
  return (
    <div>
      <div className="flex h-3 gap-[2px] overflow-hidden rounded-full" onMouseLeave={() => setHover(null)}>
        {data
          .filter((d) => d.cents > 0)
          .map((d) => (
            <div
              key={d.key}
              onMouseEnter={() => setHover(d.key)}
              title={`${CLASS_LABELS[d.key]}: ${fmt(d.cents)}`}
              className="h-full transition-opacity duration-200"
              style={{ width: `${(d.cents / total) * 100}%`, background: CLASS_COLORS[d.key], opacity: hover && hover !== d.key ? 0.4 : 1 }}
            />
          ))}
      </div>
      <ul className="mt-4 grid gap-2 text-[13px] sm:grid-cols-3">
        {data.map((d) => (
          <li key={d.key} className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 shrink-0 rounded-[3px]" style={{ background: CLASS_COLORS[d.key] }} />
            <span className="text-mist">{CLASS_LABELS[d.key]}</span>
            <span className="num ml-auto text-ink sm:ml-1">{Math.round((d.cents / total) * 100)}%</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
