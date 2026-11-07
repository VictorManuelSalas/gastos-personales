import { describe, expect, it } from "vitest";
import { addCooldown, billDueDates, detectSubscriptions, netWorth, wishReady } from "./recurring";

describe("servicios recurrentes", () => {
  it("mensual: un cobro por mes, recortando días cortos", () => {
    expect(billDueDates({ dayOfMonth: 31, everyMonths: 1 }, "2027-01-15", "2027-03-31")).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("bimestral (luz CFE) respeta el mes de referencia", () => {
    expect(billDueDates({ dayOfMonth: 10, everyMonths: 2, anchorMonth: 1 }, "2026-11-01", "2027-04-30")).toEqual(["2026-11-10", "2027-01-10", "2027-03-10"]);
    expect(billDueDates({ dayOfMonth: 10, everyMonths: 2, anchorMonth: 2 }, "2026-11-01", "2027-02-28")).toEqual(["2026-12-10", "2027-02-10"]);
  });
});

describe("detector de suscripciones (RF-41)", () => {
  const today = "2026-11-07";
  const rows = [
    { merchant: "Netflix", amountCents: 29_900, date: "2026-07-03" },
    { merchant: "NETFLIX", amountCents: 29_900, date: "2026-08-03" },
    { merchant: "Netflix", amountCents: 29_900, date: "2026-09-03" },
    { merchant: "Netflix", amountCents: 29_900, date: "2026-10-03" },
    { merchant: "OXXO", amountCents: 4_500, date: "2026-10-01" },
    { merchant: "OXXO", amountCents: 12_000, date: "2026-10-02" },
    { merchant: "OXXO", amountCents: 3_000, date: "2026-09-12" },
    { merchant: "OXXO", amountCents: 8_000, date: "2026-08-20" },
    { merchant: "Gym", amountCents: 50_000, date: "2026-09-05" },
    { merchant: "Gym", amountCents: 50_000, date: "2026-10-05" },
  ];

  it("encuentra cargos mensuales parecidos y descarta compras variables", () => {
    const found = detectSubscriptions(rows, today);
    expect(found.map((f) => f.merchant)).toEqual(["Netflix"]);
    expect(found[0]).toMatchObject({ amountCents: 29_900, dayOfMonth: 3, occurrences: 4 });
  });

  it("no sugiere lo que ya está registrado", () => {
    expect(detectSubscriptions(rows, today, ["netflix"])).toEqual([]);
  });
});

describe("patrimonio y lista de deseos", () => {
  it("activos menos pasivos", () => {
    expect(netWorth({ accountsCents: 2_000_000, receivablesCents: 725_000, cardDebtCents: 1_000_000, msiPendingCents: 1_080_000, loansPendingCents: 0 })).toEqual({
      assets: 2_725_000,
      liabilities: 2_080_000,
      net: 645_000,
    });
  });

  it("72 horas de enfriamiento", () => {
    const start = new Date("2026-11-07T10:00:00Z");
    const ready = addCooldown(start);
    expect(ready.toISOString()).toBe("2026-11-10T10:00:00.000Z");
    expect(wishReady(ready, new Date("2026-11-10T09:59:00Z"))).toBe(false);
    expect(wishReady(ready, new Date("2026-11-10T10:00:00Z"))).toBe(true);
  });
});
