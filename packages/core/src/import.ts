import { cutDateFor, cycleForCut, type CreditRule } from "./cycles";
import { diffDays, monthStart, parse, type ISODate } from "./dates";

/** Un renglón de una pestaña mensual del Excel (tarjeta, monto, corte, límite, pagado). */
export type SheetRow = {
  sheet: string;
  /** Orden de la pestaña en el libro (las posteriores ganan si repiten un corte). */
  sheetIndex: number;
  name: string;
  amountCents: number;
  cut: ISODate;
  due: ISODate;
  paid: boolean;
  note?: string;
};

export type InferredCycle = { cut: ISODate; due: ISODate; amountCents: number; paid: boolean; sheet: string };

export type InferredLine = {
  name: string;
  kind: "card" | "loan";
  rule: CreditRule;
  /** Cuántos renglones del Excel coinciden exactamente con la regla deducida. */
  matches: number;
  total: number;
  fixedPaymentCents: number | null;
  cycles: InferredCycle[];
  notes: string[];
};

const mode = (values: number[]) => {
  const counts = new Map<number, number>();
  for (const v of values) counts.set(v, (counts.get(v) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0] - b[0])[0]?.[0];
};

/** Meses recientes con los que se deduce la regla. */
const RECENT = 6;

const LOAN_NAME =/\b(kia|carro|auto|coche|moto|pr[eé]stamo|hipoteca|cr[eé]dito automotriz)\b/i;
const LOAN_NOTE = /mensualidad/i;

/**
 * Deduce la regla de cada tarjeta a partir del historial (RN-01): el día de corte
 * más frecuente y la regla de fecha límite ("+N días" o "día fijo") que reproduce
 * más fechas reales. Un renglón con fechas mal copiadas no cambia el resultado.
 */
export function inferLines(rows: SheetRow[]): InferredLine[] {
  const groups = new Map<string, SheetRow[]>();
  for (const r of rows) {
    const key = r.name.trim().toLowerCase();
    if (!key) continue;
    groups.set(key, [...(groups.get(key) ?? []), r]);
  }

  const out: InferredLine[] = [];
  for (const all of groups.values()) {
    const list = [...all].sort((a, b) => a.sheetIndex - b.sheetIndex);
    const name = list[list.length - 1]!.name.trim();
    // Las reglas cambian con el tiempo: se deducen con los meses más recientes.
    const recent = list.slice(-RECENT);

    const amountsRaw = list.map((r) => r.amountCents).filter((a) => a > 0);
    const steady = amountsRaw.length >= 3 && amountsRaw.slice(-3).every((a) => a === amountsRaw[amountsRaw.length - 1]);
    const isLoan = LOAN_NAME.test(name) || (steady && list.some((r) => LOAN_NOTE.test(r.note ?? "")));

    let best: { rule: CreditRule; matches: number };
    if (isLoan) {
      // En un préstamo lo que importa es el día de pago: corte = día de pago, +0 días.
      const payDay = mode(recent.map((r) => parse(r.due).d))!;
      const rule: CreditRule = { cutDay: payDay, due: { kind: "days_after", days: 0 } };
      best = { rule, matches: recent.filter((r) => parse(r.due).d === payDay).length };
    } else {
      const cutDay = mode(recent.map((r) => parse(r.cut).d))!;
      // Se prueba cada regla que aparezca en los meses recientes.
      const candidates: CreditRule[] = [
        ...new Set(recent.map((r) => diffDays(r.cut, r.due)).filter((n) => n >= 0 && n <= 60)),
      ].map((days) => ({ cutDay, due: { kind: "days_after", days } }) as CreditRule);
      for (const day of new Set(recent.map((r) => parse(r.due).d))) candidates.push({ cutDay, due: { kind: "fixed_day", day } });

      const fits = (r: SheetRow, rule: CreditRule) => parse(r.cut).d === cutDay && cycleForCut(r.cut, rule).due === r.due;
      // Desempates, en orden: acierta el mes más reciente; aciertos ponderados por recencia;
      // "+28 días o más" suele ser un día fijo, y menos de 28 suele ser "+N días".
      const recency = (rule: CreditRule) => recent.reduce((s, r, i) => s + (fits(r, rule) ? i + 1 : 0), 0);
      const style = (rule: CreditRule) => {
        const long = recent.filter((r) => diffDays(r.cut, r.due) >= 28).length * 2 >= recent.length;
        return (rule.due.kind === "fixed_day") === long ? 1 : 0;
      };
      const latest = recent[recent.length - 1]!;
      best = candidates
        .map((rule) => ({ rule, matches: recent.filter((r) => fits(r, rule)).length }))
        .sort(
          (a, b) =>
            b.matches - a.matches ||
            Number(fits(latest, b.rule)) - Number(fits(latest, a.rule)) ||
            recency(b.rule) - recency(a.rule) ||
            style(b.rule) - style(a.rule),
        )[0] ?? {
        rule: { cutDay, due: { kind: "days_after", days: 20 } },
        matches: 0,
      };
    }

    // Un ciclo por mes; si se repite en varias pestañas, gana la más reciente.
    // En préstamos el mes lo da la fecha de pago; en tarjetas, la de corte.
    const byCut = new Map<ISODate, InferredCycle>();
    for (const r of list) {
      const { y, m } = parse(isLoan ? r.due : r.cut);
      const cut = cutDateFor(y, m, best.rule.cutDay);
      byCut.set(cut, { cut, due: cycleForCut(cut, best.rule).due, amountCents: r.amountCents, paid: r.paid, sheet: r.sheet });
    }
    // Se conservan los meses en $0: dicen "no hubo nada que pagar".
    const cycles = [...byCut.values()].sort((a, b) => a.cut.localeCompare(b.cut));
    const amounts = cycles.map((c) => c.amountCents).filter((a) => a > 0);

    const notes: string[] = [];
    if (best.matches < recent.length) {
      notes.push(
        `En ${recent.length - best.matches} de tus últimos ${recent.length} meses las fechas del Excel no siguen esta regla. Suele pasar cuando una pestaña se copió del mes anterior sin actualizar las fechas; revísala después de importar.`,
      );
    }

    out.push({
      name,
      kind: isLoan ? "loan" : "card",
      rule: best.rule,
      matches: best.matches,
      total: recent.length,
      fixedPaymentCents: isLoan ? (amounts[amounts.length - 1] ?? null) : null,
      cycles,
      notes,
    });
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Compra a MSI tal como viene en la hoja de deudas. */
export type SheetInstallment = {
  product: string;
  bank: string;
  priceCents: number;
  months: number;
  paidMonths: number;
  paidCents: number | null;
};

/**
 * Convierte una compra a MSI del Excel: la cuota sale de lo abonado (o precio/meses)
 * y la primera mensualidad se ubica contando hacia atrás desde el ciclo abierto.
 */
export function inferInstallment(i: SheetInstallment, openCut: ISODate, cutDay: number) {
  const monthly =
    i.paidMonths > 0 && i.paidCents && i.paidCents > 0 ? Math.round(i.paidCents / i.paidMonths) : Math.round(i.priceCents / i.months);
  const first = monthStart(openCut, -i.paidMonths);
  const { y, m } = parse(first);
  return {
    monthlyCents: monthly,
    firstCut: cutDateFor(y, m, cutDay),
    pendingCents: Math.max(0, i.priceCents - i.paidMonths * monthly),
    done: i.paidMonths >= i.months,
  };
}
