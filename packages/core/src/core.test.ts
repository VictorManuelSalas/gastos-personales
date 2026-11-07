import { describe, expect, it } from "vitest";
import {
  assignPayday,
  bankHolidays,
  cycleContaining,
  cycleForCut,
  cyclesWithDueBetween,
  DEFAULT_PAYDAYS,
  formatMXN,
  installmentNumberAt,
  installmentProgress,
  installmentsDueAt,
  isBusinessDay,
  monthlyOf,
  paydaysBetween,
  parseMoney,
  projectQuincenas,
  quincenaFor,
  type CreditRule,
  type FlowItem,
} from "./index";

// Reglas de las tarjetas reales de la hoja "Noviembre 2" del Excel.
const cards: Record<string, CreditRule> = {
  BBVA: { cutDay: 10, due: { kind: "days_after", days: 20 } },
  Plata: { cutDay: 14, due: { kind: "fixed_day", day: 14 } },
  "Mercado Pago": { cutDay: 7, due: { kind: "days_after", days: 10 } },
  Rappi: { cutDay: 6, due: { kind: "days_after", days: 20 } },
  NU: { cutDay: 16, due: { kind: "days_after", days: 12 } },
  Stori: { cutDay: 12, due: { kind: "fixed_day", day: 2 } },
  Didi: { cutDay: 26, due: { kind: "days_after", days: 16 } },
  KIA: { cutDay: 16, due: { kind: "fixed_day", day: 14 } },
};

describe("ciclos (RN-01)", () => {
  it("CA-01: corte día 10 con +20 días → límite 30 nov", () => {
    expect(cycleForCut("2026-11-10", cards.BBVA!)).toMatchObject({ start: "2026-10-11", cut: "2026-11-10", due: "2026-11-30" });
  });

  it("CA-02: día fijo 14 → límite 14 dic", () => {
    expect(cycleForCut("2026-11-14", cards.Plata!).due).toBe("2026-12-14");
  });

  it("reproduce las fechas límite de la hoja 'Noviembre 2'", () => {
    const expected: Record<string, [string, string]> = {
      BBVA: ["2026-11-10", "2026-11-30"],
      Plata: ["2026-11-14", "2026-12-14"],
      "Mercado Pago": ["2026-11-07", "2026-11-17"],
      Rappi: ["2026-11-06", "2026-11-26"],
      NU: ["2026-11-16", "2026-11-28"],
      Stori: ["2026-11-12", "2026-12-02"],
      Didi: ["2026-11-26", "2026-12-12"],
      KIA: ["2026-11-16", "2026-12-14"],
    };
    for (const [name, [cut, due]] of Object.entries(expected)) {
      expect(cycleForCut(cut, cards[name]!).due, name).toBe(due);
    }
  });

  it("recorta el día de corte en meses cortos", () => {
    const rule: CreditRule = { cutDay: 31, due: { kind: "days_after", days: 20 } };
    const c = cycleContaining("2027-02-10", rule);
    expect(c.cut).toBe("2027-02-28");
    expect(c.start).toBe("2027-02-01");
  });

  it("encuentra el ciclo que contiene una fecha", () => {
    expect(cycleContaining("2026-11-20", cards.NU!)).toMatchObject({ start: "2026-11-17", cut: "2026-12-16" });
    expect(cycleContaining("2026-11-16", cards.NU!).cut).toBe("2026-11-16");
  });

  it("RN-02: marca y ajusta fechas límite en día inhábil", () => {
    // 28 nov 2026 es sábado.
    const nu = cycleForCut("2026-11-16", cards.NU!);
    expect(nu.nonBusiness).toBe(true);
    expect(nu.due).toBe("2026-11-28");
    const adjusted = cycleForCut("2026-11-16", { ...cards.NU!, policy: "previous" });
    expect(adjusted.due).toBe("2026-11-27");
    expect(adjusted.dueRaw).toBe("2026-11-28");
  });

  it("lista ciclos por rango de fecha límite", () => {
    const list = cyclesWithDueBetween(cards.Plata!, "2026-11-01", "2027-01-31");
    expect(list.map((c) => c.due)).toEqual(["2026-11-14", "2026-12-14", "2027-01-14"]);
  });
});

describe("días inhábiles", () => {
  it("incluye los días bancarios de 2026", () => {
    const h = bankHolidays(2026);
    for (const d of ["2026-01-01", "2026-02-02", "2026-03-16", "2026-04-02", "2026-04-03", "2026-11-16", "2026-12-12", "2026-12-25"]) {
      expect(h.has(d), d).toBe(true);
    }
    expect(isBusinessDay("2026-11-17")).toBe(true);
    expect(isBusinessDay("2026-11-14")).toBe(false); // sábado
  });
});

describe("quincenas (RN-03, RN-04)", () => {
  it("CA-03: asigna cada pago al último cobro ≤ fecha límite", () => {
    const toPayday = (d: string) => assignPayday(DEFAULT_PAYDAYS, d);
    for (const due of ["2026-11-17", "2026-11-26", "2026-11-28"]) expect(toPayday(due), due).toBe("2026-11-15");
    for (const due of ["2026-11-30", "2026-12-02", "2026-12-12", "2026-12-14"]) expect(toPayday(due), due).toBe("2026-11-30");
  });

  it("CA-03b: el último día del mes respeta febrero", () => {
    const list = paydaysBetween(DEFAULT_PAYDAYS, "2027-01-16", "2027-04-30").filter((d) => !d.endsWith("-15"));
    expect(list).toEqual(["2027-01-31", "2027-02-28", "2027-03-31", "2027-04-30"]);
    expect(assignPayday(DEFAULT_PAYDAYS, "2027-03-01")).toBe("2027-02-28");
  });

  it("calcula la quincena actual", () => {
    expect(quincenaFor(DEFAULT_PAYDAYS, "2026-11-07")).toEqual({ payday: "2026-10-31", end: "2026-11-14", next: "2026-11-15" });
    expect(quincenaFor(DEFAULT_PAYDAYS, "2026-11-15").payday).toBe("2026-11-15");
  });

  it("puede adelantar el cobro al día hábil anterior", () => {
    const rule = { days: [15, "last"] as (number | "last")[], policy: "previous_business" as const };
    // 15 nov 2026 es domingo → viernes 13.
    expect(paydaysBetween(rule, "2026-11-01", "2026-11-20")).toEqual(["2026-11-13"]);
  });
});

describe("proyección de quincenas (RN-06)", () => {
  const item = (p: Partial<FlowItem>): FlowItem => ({
    id: Math.random().toString(36),
    kind: "card",
    label: "x",
    date: "2026-11-20",
    payday: "2026-11-15",
    amountCents: 0,
    direction: "out",
    status: "pending",
    ...p,
  });

  it("CA-04: saldo inicial + ingresos − pagos", () => {
    const [q] = projectQuincenas({
      today: "2026-11-15",
      balanceCents: 1_200_000,
      rule: DEFAULT_PAYDAYS,
      count: 1,
      items: [
        item({ direction: "in", kind: "income", amountCents: 1_250_000 }),
        item({ amountCents: 1_000_000 }),
        item({ amountCents: 150_000 }),
      ],
    });
    expect(q!.endCents).toBe(1_300_000);
  });

  it("encadena quincenas, ignora lo ya pagado y arrastra vencidos", () => {
    const blocks = projectQuincenas({
      today: "2026-11-20",
      balanceCents: 500_000,
      rule: DEFAULT_PAYDAYS,
      count: 2,
      items: [
        item({ payday: "2026-10-31", amountCents: 100_000 }), // vencido
        item({ payday: "2026-11-15", amountCents: 200_000, status: "done" }), // ya pagado
        item({ payday: "2026-11-30", kind: "income", direction: "in", amountCents: 1_000_000 }),
        item({ payday: "2026-11-30", amountCents: 300_000 }),
      ],
    });
    expect(blocks[0]!.items.find((i) => i.overdue)?.amountCents).toBe(100_000);
    expect(blocks[0]!.endCents).toBe(400_000);
    expect(blocks[1]!.startCents).toBe(400_000);
    expect(blocks[1]!.endCents).toBe(1_100_000);
    expect(blocks[1]!.end).toBe("2026-12-14");
  });
});

describe("MSI (RN-07)", () => {
  const laptop = { priceCents: 549_900, months: 18, firstCut: "2026-01-10" };

  it("CA-08: $5,499 a 18 meses → $305.50 por ciclo", () => {
    expect(monthlyOf(laptop)).toBe(30_550);
    expect(installmentNumberAt(laptop, "2026-01-10")).toBe(1);
    expect(installmentNumberAt(laptop, "2027-06-10")).toBe(18);
    expect(installmentNumberAt(laptop, "2027-07-10")).toBeNull();
    expect(installmentNumberAt(laptop, "2025-12-10")).toBeNull();
  });

  it("calcula avance y suma cuotas por corte", () => {
    expect(installmentProgress(laptop, "2026-10-10")).toMatchObject({ paid: 10, pending: 8, pendingCents: 549_900 - 10 * 30_550 });
    const refri = { priceCents: 1_754_000, months: 12, monthlyCents: 146_200, firstCut: "2025-12-10" };
    expect(installmentsDueAt([laptop, refri], "2026-11-10")).toBe(30_550 + 146_200);
  });
});

describe("dinero (RN-11)", () => {
  it("convierte texto a centavos", () => {
    expect(parseMoney("1,234.50")).toBe(123_450);
    expect(parseMoney("$ 65")).toBe(6_500);
    expect(parseMoney("4568.7")).toBe(456_870);
    expect(parseMoney("abc")).toBeNull();
    expect(parseMoney("1.234")).toBeNull();
  });

  it("formatea en pesos", () => {
    expect(formatMXN(456_871)).toBe("$4,568.71");
  });
});
