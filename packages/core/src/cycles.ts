import { addDays, dayInMonth, monthStart, parse, type ISODate } from "./dates";
import { isBusinessDay, nextBusinessDay, previousBusinessDay } from "./holidays";

/** RN-01: la fecha límite es "corte + N días" o "día fijo" del mes siguiente al corte. */
export type DueRule = { kind: "days_after"; days: number } | { kind: "fixed_day"; day: number };

/** RN-02: qué hacer si la fecha límite cae en día inhábil. */
export type BusinessDayPolicy = "none" | "previous" | "next";

export type CreditRule = {
  cutDay: number;
  due: DueRule;
  policy?: BusinessDayPolicy;
};

export type Cycle = {
  /** Primer día del periodo (día siguiente al corte anterior). */
  start: ISODate;
  cut: ISODate;
  /** Fecha límite efectiva (ya ajustada por día inhábil si aplica). */
  due: ISODate;
  /** Fecha límite calculada antes del ajuste. */
  dueRaw: ISODate;
  /** true si la fecha límite cae (o caía) en día inhábil. */
  nonBusiness: boolean;
};

/** Fecha de corte de un mes (recortada si el mes no tiene ese día). */
export function cutDateFor(y: number, m: number, cutDay: number): ISODate {
  return dayInMonth(y, m, cutDay);
}

export function dueDateFor(cut: ISODate, rule: CreditRule): Pick<Cycle, "due" | "dueRaw" | "nonBusiness"> {
  let raw: ISODate;
  if (rule.due.kind === "days_after") {
    raw = addDays(cut, rule.due.days);
  } else {
    // Primera fecha estrictamente posterior al corte con ese día del mes.
    const { y, m } = parse(cut);
    const sameMonth = dayInMonth(y, m, rule.due.day);
    raw = sameMonth > cut ? sameMonth : dayInMonth(y, m + 1, rule.due.day);
  }
  const nonBusiness = !isBusinessDay(raw);
  const policy = rule.policy ?? "none";
  const due =
    !nonBusiness || policy === "none" ? raw : policy === "previous" ? previousBusinessDay(raw) : nextBusinessDay(raw);
  return { due, dueRaw: raw, nonBusiness };
}

export function cycleForCut(cut: ISODate, rule: CreditRule): Cycle {
  const { y, m } = parse(cut);
  const prevCut = cutDateFor(y, m - 1, rule.cutDay);
  return { start: addDays(prevCut, 1), cut, ...dueDateFor(cut, rule) };
}

/** Ciclo con corte en el mes de `date`. */
export function cycleInMonth(date: ISODate, rule: CreditRule): Cycle {
  const { y, m } = parse(date);
  return cycleForCut(cutDateFor(y, m, rule.cutDay), rule);
}

/** Ciclo cuyo periodo contiene `date` (start ≤ date ≤ cut). */
export function cycleContaining(date: ISODate, rule: CreditRule): Cycle {
  const c = cycleInMonth(date, rule);
  return date <= c.cut ? c : cycleInMonth(monthStart(date, 1), rule);
}

/** Ciclos con corte entre `from` y `to` (inclusive), en orden. */
export function cyclesWithCutBetween(rule: CreditRule, from: ISODate, to: ISODate): Cycle[] {
  const out: Cycle[] = [];
  let month = monthStart(from);
  for (let i = 0; i < 240 && month <= to; i++) {
    const { y, m } = parse(month);
    const cut = cutDateFor(y, m, rule.cutDay);
    if (cut >= from && cut <= to) out.push(cycleForCut(cut, rule));
    month = monthStart(month, 1);
  }
  return out;
}

/** Ciclos cuya fecha límite cae entre `from` y `to` (inclusive). */
export function cyclesWithDueBetween(rule: CreditRule, from: ISODate, to: ISODate): Cycle[] {
  // La fecha límite cae como máximo ~2 meses después del corte.
  return cyclesWithCutBetween(rule, monthStart(from, -3), to).filter((c) => c.due >= from && c.due <= to);
}
