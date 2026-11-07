/**
 * Fechas civiles como texto ISO "YYYY-MM-DD" (sin hora ni zona).
 * Se comparan con < y > porque el formato ISO ordena lexicográficamente.
 */
export type ISODate = string;

export const TZ = "America/Mexico_City";

type YMD = { y: number; m: number; d: number };

const pad = (n: number) => String(n).padStart(2, "0");

export function parse(s: ISODate): YMD {
  const [y, m, d] = s.split("-").map(Number);
  return { y: y!, m: m!, d: d! };
}

export function iso(y: number, m: number, d: number): ISODate {
  // Normaliza desbordes (p. ej. mes 13 o día 0) con Date.UTC.
  const t = new Date(Date.UTC(y, m - 1, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

export const lastDayOfMonth = (y: number, m: number) => new Date(Date.UTC(y, m, 0)).getUTCDate();

/** Día `day` del mes, recortado al último día si el mes es más corto (31 → 30, 28…). */
export const dayInMonth = (y: number, m: number, day: number): ISODate => iso(y, m, Math.min(day, lastDayOfMonth(y, m)));

export function addDays(s: ISODate, n: number): ISODate {
  const { y, m, d } = parse(s);
  return iso(y, m, d + n);
}

/** Primer día del mes desplazado `n` meses. */
export function monthStart(s: ISODate, n = 0): ISODate {
  const { y, m } = parse(s);
  return iso(y, m + n, 1);
}

export function diffDays(from: ISODate, to: ISODate): number {
  const a = parse(from);
  const b = parse(to);
  return Math.round((Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86_400_000);
}

/** Índice de mes absoluto (útil para contar meses entre fechas). */
export const monthIndex = (s: ISODate) => {
  const { y, m } = parse(s);
  return y * 12 + (m - 1);
};

/** 0 = domingo … 6 = sábado */
export function weekday(s: ISODate): number {
  const { y, m, d } = parse(s);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export const minDate = (a: ISODate, b: ISODate) => (a < b ? a : b);
export const maxDate = (a: ISODate, b: ISODate) => (a > b ? a : b);

/** "Hoy" en la zona horaria dada. */
export function today(tz = TZ, now = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
  return iso(get("year"), get("month"), get("day"));
}
