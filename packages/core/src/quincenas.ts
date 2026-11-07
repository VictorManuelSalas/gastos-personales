import type { ISODate } from "./dates";
import { upcomingPaydays, type PaydayRule } from "./paydays";

/** Un renglón de la vista "Mis quincenas". */
export type FlowItem = {
  id: string;
  kind: "income" | "card" | "loan" | "goal" | "bill";
  label: string;
  /** Fecha límite (pagos) o fecha de cobro (ingresos). */
  date: ISODate;
  /** Quincena asignada (RN-04 o asignación manual). */
  payday: ISODate;
  amountCents: number;
  direction: "in" | "out";
  /** "done": ya se pagó o se cobró, y por lo tanto ya está reflejado en el saldo. */
  status: "pending" | "done";
  /** Monto estimado (sin estado de cuenta o ingreso sin confirmar). */
  estimated?: boolean;
  /** Se calcula al proyectar: pago pendiente de una quincena anterior. */
  overdue?: boolean;
  ref?: Record<string, string>;
};

export type QuincenaBlock = {
  payday: ISODate;
  /** Último día de la quincena (día previo al siguiente cobro). */
  end: ISODate;
  isCurrent: boolean;
  startCents: number;
  inCents: number;
  outCents: number;
  endCents: number;
  items: FlowItem[];
};

/**
 * RN-06: proyecta el saldo quincena por quincena.
 *
 * `balanceCents` es el saldo disponible hoy (suma de cuentas), que ya incluye
 * todo lo pagado o cobrado. Por eso solo los renglones pendientes mueven el saldo.
 * Los pagos pendientes de quincenas pasadas se cargan a la actual como vencidos.
 */
export function projectQuincenas(input: {
  today: ISODate;
  balanceCents: number;
  rule: PaydayRule;
  items: FlowItem[];
  count: number;
}): QuincenaBlock[] {
  const paydays = upcomingPaydays(input.rule, input.today, input.count + 1);
  const first = paydays[0]!;
  const blocks: QuincenaBlock[] = [];
  let carry = input.balanceCents;

  for (let i = 0; i < input.count; i++) {
    const payday = paydays[i]!;
    const next = paydays[i + 1]!;
    const items = input.items
      .filter((it) => {
        if (it.payday === payday) return true;
        // Vencidos: pendientes asignados a una quincena anterior a la actual.
        return i === 0 && it.payday < first && it.status === "pending";
      })
      .map((it) => (it.payday < first ? { ...it, overdue: true } : it))
      .sort((a, b) => Number(a.direction === "out") - Number(b.direction === "out") || a.date.localeCompare(b.date));

    const pending = items.filter((it) => it.status === "pending");
    const inCents = pending.filter((it) => it.direction === "in").reduce((s, it) => s + it.amountCents, 0);
    const outCents = pending.filter((it) => it.direction === "out").reduce((s, it) => s + it.amountCents, 0);
    const startCents = carry;
    const endCents = startCents + inCents - outCents;
    carry = endCents;

    blocks.push({
      payday,
      end: dayBefore(next),
      isCurrent: i === 0,
      startCents,
      inCents,
      outCents,
      endCents,
      items,
    });
  }
  return blocks;
}

function dayBefore(d: ISODate): ISODate {
  const [y, m, day] = d.split("-").map(Number);
  const t = new Date(Date.UTC(y!, m! - 1, day! - 1));
  return t.toISOString().slice(0, 10);
}
