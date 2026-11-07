import { centsToInput, formatMXN, type FlowItem } from "@gp/core";
import { fmtDay } from "@/lib/dates";
import type { RowItem } from "./flow-row";

/** Convierte renglones del core a props serializables para el cliente. */
export function toRows(items: FlowItem[], today: string): RowItem[] {
  return items.map((it) => ({
    id: it.id,
    kind: it.kind,
    label: it.label,
    dateLabel: it.direction === "in" ? `Cobro ${fmtDay(it.date)}` : it.kind === "goal" ? `Apartado de la quincena` : it.kind === "bill" ? `Vence ${fmtDay(it.date)}` : `Límite ${fmtDay(it.date)}`,
    amountLabel: formatMXN(it.amountCents),
    amountInput: centsToInput(it.amountCents),
    direction: it.direction,
    status: it.status,
    estimated: it.estimated,
    overdue: it.overdue,
    confirmable: it.direction === "in" && it.date <= today,
    color: it.ref?.color,
    ref: it.ref,
  }));
}
