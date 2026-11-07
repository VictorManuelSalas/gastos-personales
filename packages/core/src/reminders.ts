import { diffDays, type ISODate } from "./dates";
import { formatMXN } from "./money";

/** Un pago pendiente que puede generar avisos. */
export type PendingPayment = {
  lineId: string;
  lineName: string;
  kind: "card" | "loan";
  cut: ISODate;
  due: ISODate;
  payday: ISODate;
  amountCents: number;
  /** El ciclo cortó hoy y aún no tiene monto del estado de cuenta. */
  needsStatement?: boolean;
};

export type Reminder = {
  /** Clave única: el mismo aviso nunca se envía dos veces (RNF-10). */
  key: string;
  kind: "due" | "due_evening" | "overdue" | "cut" | "payday";
  text: string;
  /** Botones: [texto, dato de callback]. */
  buttons?: [string, string][];
};

export type ReminderPrefs = {
  /** Días antes de la fecha límite en que se avisa (0 = el mismo día). */
  days: number[];
  quietStart: number;
  quietEnd: number;
};

export function inQuietHours(hour: number, p: Pick<ReminderPrefs, "quietStart" | "quietEnd">) {
  if (p.quietStart === p.quietEnd) return false;
  return p.quietStart < p.quietEnd ? hour >= p.quietStart && hour < p.quietEnd : hour >= p.quietStart || hour < p.quietEnd;
}

const fmtDay = (d: ISODate) =>
  new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "short", timeZone: "UTC" })
    .format(new Date(`${d}T12:00:00Z`))
    .replace(".", "");

/**
 * Decide qué avisos tocan ahora (PRD 7.11, RN-16, RN-17):
 * - fecha límite: en los días configurados, desde las 9:00, y el mismo día otra vez a las 18:00;
 * - pago vencido: el día siguiente a la fecha límite;
 * - corte: el día del corte (10:00) pide el monto del estado de cuenta;
 * - día de cobro (8:00): resumen de la quincena.
 * Nada sale en horario de silencio. El llamador filtra por clave lo que ya se envió.
 */
export function remindersDue(input: {
  userId: string;
  today: ISODate;
  hour: number;
  prefs: ReminderPrefs;
  payments: PendingPayment[];
  payday?: { date: ISODate; inCents: number; outCents: number; endCents: number; count: number } | null;
}): Reminder[] {
  const { userId, today, hour, prefs } = input;
  if (inQuietHours(hour, prefs)) return [];
  const out: Reminder[] = [];

  for (const p of input.payments) {
    if (p.amountCents <= 0 && !p.needsStatement) continue;
    const left = diffDays(today, p.due);
    const base = `${userId}:${p.lineId}:${p.cut}`;
    const amount = formatMXN(p.amountCents);
    const paidBtn: [string, string] = ["Ya pagué", `paid:${p.lineId}:${p.cut}`];

    if (p.needsStatement && p.cut === today && hour >= 10) {
      out.push({
        key: `${base}:cut`,
        kind: "cut",
        text: `✂️ Cortó ${p.lineName}. ¿Cuánto dice tu estado de cuenta? Respóndeme con el monto, por ejemplo: <b>${p.lineName.split(" ")[0]} 4568.71</b>`,
      });
    }
    if (p.amountCents <= 0) continue;

    if (left >= 0 && prefs.days.includes(left) && hour >= 9) {
      const when = left === 0 ? "vence <b>hoy</b>" : left === 1 ? "vence <b>mañana</b>" : `vence el <b>${fmtDay(p.due)}</b> (en ${left} días)`;
      out.push({
        key: `${base}:due:${left}`,
        kind: "due",
        text: `⏰ ${p.lineName}: <b>${amount}</b> ${when}. Sale de tu quincena del ${fmtDay(p.payday)}.`,
        buttons: [paidBtn],
      });
    }
    if (left === 0 && hour >= 18) {
      out.push({
        key: `${base}:due:evening`,
        kind: "due_evening",
        text: `⏰ Último recordatorio: ${p.lineName} vence hoy, <b>${amount}</b>.`,
        buttons: [paidBtn],
      });
    }
    if (left === -1 && hour >= 9) {
      out.push({
        key: `${base}:overdue`,
        kind: "overdue",
        text: `⚠️ ${p.lineName} venció ayer y no está marcado como pagado (<b>${amount}</b>). Si ya pagaste, márcalo para que tu quincena cuadre.`,
        buttons: [paidBtn],
      });
    }
  }

  const pd = input.payday;
  if (pd && pd.date === today && hour >= 8) {
    out.push({
      key: `${userId}:payday:${today}`,
      kind: "payday",
      text:
        `💸 Hoy es día de cobro.\n` +
        `Entran <b>${formatMXN(pd.inCents)}</b> y esta quincena pagas <b>${formatMXN(pd.outCents)}</b> ` +
        `(${pd.count} ${pd.count === 1 ? "pago" : "pagos"}).\n` +
        `Te quedan <b>${formatMXN(pd.endCents)}</b>.`,
    });
  }
  return out;
}
