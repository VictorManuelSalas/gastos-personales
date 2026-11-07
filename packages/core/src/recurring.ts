import { addDays, dayInMonth, diffDays, monthIndex, monthStart, parse, type ISODate } from "./dates";
import { normalizeText } from "./messages";

/** Fechas de cobro de un servicio o suscripción entre `from` y `to` (inclusive). */
export function billDueDates(
  bill: { dayOfMonth: number; everyMonths: number; anchorMonth?: number | null },
  from: ISODate,
  to: ISODate,
): ISODate[] {
  const out: ISODate[] = [];
  const every = Math.max(1, bill.everyMonths);
  let m = monthStart(from);
  for (let i = 0; i < 120 && m <= to; i++) {
    const { y, m: mm } = parse(m);
    const anchor = bill.anchorMonth ?? 1;
    if (every === 1 || (((mm - anchor) % every) + every) % every === 0) {
      const d = dayInMonth(y, mm, bill.dayOfMonth);
      if (d >= from && d <= to) out.push(d);
    }
    m = monthStart(m, 1);
  }
  return out;
}

export type DetectedSubscription = {
  key: string;
  merchant: string;
  amountCents: number;
  dayOfMonth: number;
  occurrences: number;
  lastDate: ISODate;
};

const median = (xs: number[]) => {
  const s = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid]! : Math.round((s[mid - 1]! + s[mid]!) / 2);
};

/**
 * Detector de suscripciones (RF-41): mismo comercio, al menos 3 meses distintos en
 * los últimos 6, montos parecidos (±15 %) y separación de ~un mes entre cargos.
 */
export function detectSubscriptions(
  txns: { merchant: string | null; amountCents: number; date: ISODate }[],
  today: ISODate,
  known: string[] = [],
): DetectedSubscription[] {
  const since = monthStart(today, -6);
  const knownKeys = new Set(known.map((k) => normalizeText(k)));
  const groups = new Map<string, { merchant: string; rows: { amountCents: number; date: ISODate }[] }>();
  for (const t of txns) {
    if (!t.merchant || t.date < since) continue;
    const key = normalizeText(t.merchant);
    if (!key || knownKeys.has(key)) continue;
    const g = groups.get(key) ?? { merchant: t.merchant, rows: [] };
    g.rows.push({ amountCents: t.amountCents, date: t.date });
    groups.set(key, g);
  }

  const out: DetectedSubscription[] = [];
  for (const [key, g] of groups) {
    const rows = g.rows.sort((a, b) => a.date.localeCompare(b.date));
    const months = new Set(rows.map((r) => monthIndex(r.date)));
    if (months.size < 3) continue;
    const med = median(rows.map((r) => r.amountCents));
    if (!rows.every((r) => Math.abs(r.amountCents - med) <= med * 0.15)) continue;
    const gaps = rows.slice(1).map((r, i) => diffDays(rows[i]!.date, r.date));
    const gap = median(gaps);
    if (gap < 25 || gap > 35) continue;
    const days = rows.map((r) => parse(r.date).d);
    out.push({
      key,
      merchant: g.merchant,
      amountCents: med,
      dayOfMonth: median(days),
      occurrences: rows.length,
      lastDate: rows[rows.length - 1]!.date,
    });
  }
  return out.sort((a, b) => b.amountCents - a.amountCents);
}

/** Patrimonio neto (RF-42): lo que tienes menos lo que debes. */
export function netWorth(i: {
  accountsCents: number;
  receivablesCents: number;
  cardDebtCents: number;
  msiPendingCents: number;
  loansPendingCents: number;
}) {
  const assets = i.accountsCents + i.receivablesCents;
  const liabilities = i.cardDebtCents + i.msiPendingCents + i.loansPendingCents;
  return { assets, liabilities, net: assets - liabilities };
}

/** ¿Ya pasaron las 72 h de enfriamiento? (RF-37) */
export const wishReady = (availableAt: Date, now = new Date()) => availableAt.getTime() <= now.getTime();

export const COOLDOWN_HOURS = 72;

export const addCooldown = (from = new Date()) => new Date(from.getTime() + COOLDOWN_HOURS * 3_600_000);

// Útil para pruebas: fecha ISO a partir de hoy.
export const daysFrom = (d: ISODate, n: number) => addDays(d, n);
