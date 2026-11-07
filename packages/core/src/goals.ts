import type { ISODate } from "./dates";
import { paydayAfter, type PaydayRule } from "./paydays";

const STEP = 5_000; // $50 en centavos

/** Días de cobro estrictamente después de hoy y hasta la fecha objetivo (inclusive). */
export function paydaysUntil(rule: PaydayRule, today: ISODate, target: ISODate): number {
  let n = 0;
  let d = paydayAfter(rule, today);
  while (d <= target && n < 1000) {
    n++;
    d = paydayAfter(rule, d);
  }
  return n;
}

/** RN-12: (objetivo − ahorrado) / quincenas restantes, redondeado hacia arriba a múltiplos de $50. */
export function suggestedContribution(targetCents: number, savedCents: number, paydaysLeft: number): number {
  const remaining = Math.max(0, targetCents - savedCents);
  if (remaining === 0) return 0;
  const per = remaining / Math.max(1, paydaysLeft);
  return Math.ceil(per / STEP) * STEP;
}

/** RN-14: N meses × gasto esencial mensual promedio. */
export const emergencyTarget = (avgEssentialMonthlyCents: number, months: number) => Math.round(avgEssentialMonthlyCents * months);

/** Con un aporte fijo por quincena, ¿en qué día de cobro se llega? null si no hay aporte. */
export function reachDate(rule: PaydayRule, today: ISODate, remainingCents: number, perPaydayCents: number | null): ISODate | null {
  if (remainingCents <= 0) return today;
  if (!perPaydayCents || perPaydayCents <= 0) return null;
  let needed = Math.ceil(remainingCents / perPaydayCents);
  let d = today;
  while (needed-- > 0) d = paydayAfter(rule, d);
  return d;
}

export const progressPct = (savedCents: number, targetCents: number | null) =>
  targetCents && targetCents > 0 ? Math.min(100, Math.round((savedCents / targetCents) * 100)) : 0;
