import { addDays, dayInMonth, monthStart, parse, type ISODate } from "./dates";
import { previousBusinessDay } from "./holidays";

/**
 * RN-03: días de cobro. "last" = último día del mes (30/31, 28/29 en febrero).
 * Por defecto: 15 y último, sin mover por fines de semana.
 */
export type PaydayRule = {
  days: (number | "last")[];
  /** "previous_business": si cae en día inhábil, se adelanta al hábil anterior. */
  policy?: "none" | "previous_business";
};

export const DEFAULT_PAYDAYS: PaydayRule = { days: [15, "last"], policy: "none" };

function paydaysOfMonth(rule: PaydayRule, y: number, m: number): ISODate[] {
  const out = rule.days.map((d) => dayInMonth(y, m, d === "last" ? 31 : d));
  const adjusted = rule.policy === "previous_business" ? out.map(previousBusinessDay) : out;
  return [...new Set(adjusted)].sort();
}

/** Días de cobro entre `from` y `to` (inclusive). */
export function paydaysBetween(rule: PaydayRule, from: ISODate, to: ISODate): ISODate[] {
  const out: ISODate[] = [];
  let month = monthStart(from, -1);
  for (let i = 0; i < 400 && month <= to; i++) {
    const { y, m } = parse(month);
    for (const p of paydaysOfMonth(rule, y, m)) if (p >= from && p <= to) out.push(p);
    month = monthStart(month, 1);
  }
  return out;
}

/** Último día de cobro en o antes de `date`. */
export function paydayOnOrBefore(rule: PaydayRule, date: ISODate): ISODate {
  const list = paydaysBetween(rule, monthStart(date, -2), date);
  return list[list.length - 1]!;
}

/** Primer día de cobro estrictamente después de `date`. */
export function paydayAfter(rule: PaydayRule, date: ISODate): ISODate {
  return paydaysBetween(rule, addDays(date, 1), monthStart(date, 2))[0]!;
}

/** Quincena que contiene `date`: del cobro anterior al día previo al siguiente. */
export function quincenaFor(rule: PaydayRule, date: ISODate) {
  const payday = paydayOnOrBefore(rule, date);
  const next = paydayAfter(rule, payday);
  return { payday, end: addDays(next, -1), next };
}

/** RN-04: un pago se asigna al último cobro que sea ≤ a su fecha límite. */
export const assignPayday = paydayOnOrBefore;

/** Próximos `count` días de cobro a partir de la quincena actual (incluida). */
export function upcomingPaydays(rule: PaydayRule, today: ISODate, count: number): ISODate[] {
  const out = [paydayOnOrBefore(rule, today)];
  while (out.length < count) out.push(paydayAfter(rule, out[out.length - 1]!));
  return out;
}

/** "15,last" → regla. Acepta "ultimo"/"último" como sinónimo de "last". Null si es inválido. */
export function parsePaydayRule(days: string, policy: string = "none"): PaydayRule | null {
  const parts = days
    .split(/[,\s]+/)
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  if (!parts.length || parts.length > 4) return null;
  const out: (number | "last")[] = [];
  for (const p of parts) {
    if (["last", "ultimo", "último"].includes(p)) out.push("last");
    else if (/^\d{1,2}$/.test(p) && Number(p) >= 1 && Number(p) <= 31) out.push(Number(p));
    else return null;
  }
  return { days: [...new Set(out)], policy: policy === "previous_business" ? "previous_business" : "none" };
}

/** Regla → "15,last" para guardar. */
export const serializePaydays = (r: PaydayRule) => r.days.join(",");

/** "15 y último día del mes" */
export function describePaydays(r: PaydayRule): string {
  const labels = r.days.map((d) => (d === "last" ? "último día del mes" : String(d)));
  const text = labels.length > 1 ? `${labels.slice(0, -1).join(", ")} y ${labels[labels.length - 1]}` : labels[0]!;
  return r.policy === "previous_business" ? `${text} (se adelanta si es inhábil)` : text;
}
