import { monthIndex, type ISODate } from "./dates";

/** Compra a meses sin intereses ligada a una tarjeta. */
export type Installment = {
  priceCents: number;
  months: number;
  /** Cuota capturada a mano; si falta, se calcula como precio / meses (RN-07). */
  monthlyCents?: number | null;
  /** Fecha de corte del ciclo donde se cobra la primera mensualidad. */
  firstCut: ISODate;
};

export const monthlyOf = (i: Installment) => i.monthlyCents ?? Math.round(i.priceCents / i.months);

/** Número de mensualidad (1…meses) que cae en el ciclo con ese corte, o null si no aplica. */
export function installmentNumberAt(i: Installment, cut: ISODate): number | null {
  const n = monthIndex(cut) - monthIndex(i.firstCut) + 1;
  return n >= 1 && n <= i.months ? n : null;
}

/** Avance al corte dado: mensualidades pagadas, pendientes y monto pendiente. */
export function installmentProgress(i: Installment, asOfCut: ISODate) {
  const raw = monthIndex(asOfCut) - monthIndex(i.firstCut) + 1;
  const paid = Math.max(0, Math.min(i.months, raw));
  const monthly = monthlyOf(i);
  return {
    monthly,
    paid,
    pending: i.months - paid,
    pendingCents: Math.max(0, i.priceCents - paid * monthly),
    done: paid >= i.months,
  };
}

/** Suma de cuotas MSI que caen en el ciclo con ese corte. */
export function installmentsDueAt(list: Installment[], cut: ISODate): number {
  return list.reduce((acc, i) => acc + (installmentNumberAt(i, cut) ? monthlyOf(i) : 0), 0);
}
