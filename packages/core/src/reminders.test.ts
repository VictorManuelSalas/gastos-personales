import { describe, expect, it } from "vitest";
import { inQuietHours, remindersDue, type PendingPayment } from "./reminders";

const prefs = { days: [5, 3, 1, 0], quietStart: 22, quietEnd: 8 };
const mp: PendingPayment = {
  lineId: "mp",
  lineName: "Mercado Pago",
  kind: "card",
  cut: "2026-11-07",
  due: "2026-11-17",
  payday: "2026-11-15",
  amountCents: 858_784,
};
const run = (today: string, hour: number, payments = [mp], extra = {}) =>
  remindersDue({ userId: "u", today, hour, prefs, payments, ...extra });

describe("avisos de fecha límite (RN-16, RN-17)", () => {
  it("CA-09: avisa 3 días antes a las 9:00 con botón de pagado", () => {
    const [r] = run("2026-11-14", 9);
    expect(r?.key).toBe("u:mp:2026-11-07:due:3");
    expect(r?.text).toContain("$8,587.84");
    expect(r?.buttons?.[0]).toEqual(["Ya pagué", "paid:mp:2026-11-07"]);
  });

  it("no avisa antes de las 9 ni en días no configurados", () => {
    expect(run("2026-11-14", 8)).toEqual([]);
    expect(run("2026-11-13", 12)).toEqual([]); // 4 días antes
  });

  it("el día límite avisa en la mañana y otra vez a las 18:00", () => {
    expect(run("2026-11-17", 10).map((r) => r.kind)).toEqual(["due"]);
    expect(run("2026-11-17", 18).map((r) => r.kind)).toEqual(["due", "due_evening"]);
  });

  it("avisa el día siguiente si quedó vencido", () => {
    expect(run("2026-11-18", 9).map((r) => r.kind)).toEqual(["overdue"]);
  });

  it("CA-11: no envía nada en horario de silencio", () => {
    expect(run("2026-11-17", 23)).toEqual([]);
    expect(inQuietHours(7, prefs)).toBe(true);
    expect(inQuietHours(8, prefs)).toBe(false);
    expect(inQuietHours(14, { quietStart: 13, quietEnd: 15 })).toBe(true);
  });

  it("pide el estado de cuenta el día del corte", () => {
    const cutToday = { ...mp, cut: "2026-11-07", amountCents: 0, needsStatement: true };
    expect(run("2026-11-07", 10, [cutToday]).map((r) => r.kind)).toEqual(["cut"]);
  });

  it("resume la quincena el día de cobro", () => {
    const r = run("2026-11-15", 8, [], { payday: { date: "2026-11-15", inCents: 1_250_000, outCents: 1_007_730, endCents: 242_270, count: 3 } });
    expect(r[0]?.kind).toBe("payday");
    expect(r[0]?.text).toContain("3 pagos");
  });
});
