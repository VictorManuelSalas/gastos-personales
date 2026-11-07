import { describe, expect, it } from "vitest";
import { budgetStatus, healthIndicators, simulateInstallment } from "./health";

const base = {
  monthlyIncomeCents: 2_500_000,
  committedMonthlyCents: 1_050_000,
  msiMonthlyCents: 300_000,
  creditUsedCents: 1_100_000,
  creditLimitCents: 5_000_000,
  emergencySavedCents: 500_000,
  essentialMonthlyCents: 1_500_000,
  monthlySpendingCents: 2_300_000,
  antMonthlyCents: 120_000,
  lentCents: 725_000,
};

describe("salud financiera (PRD 7.8)", () => {
  const byKey = Object.fromEntries(healthIndicators(base).map((i) => [i.key, i]));

  it("calcula cada indicador con su semáforo", () => {
    expect(byKey.committed).toMatchObject({ value: 42, level: "warn" });
    expect(byKey.msi).toMatchObject({ value: 12, level: "warn" });
    expect(byKey.credit).toMatchObject({ value: 22, level: "good" });
    expect(byKey.emergency).toMatchObject({ value: 0.3, level: "bad" });
    expect(byKey.savings).toMatchObject({ value: 8, level: "warn" });
    expect(byKey.ant).toMatchObject({ value: 4.8, level: "good" });
    expect(byKey.lent).toMatchObject({ value: 29, level: "bad" });
  });

  it("sin datos no inventa valores", () => {
    const none = healthIndicators({ ...base, monthlyIncomeCents: 0, creditLimitCents: 0, essentialMonthlyCents: 0 });
    expect(none.every((i) => i.value === null && i.level === null)).toBe(true);
  });
});

describe("presupuestos", () => {
  it("80 % amarillo, 100 % rojo", () => {
    expect(budgetStatus(79_000, 100_000).level).toBe("good");
    expect(budgetStatus(80_000, 100_000).level).toBe("warn");
    expect(budgetStatus(100_000, 100_000)).toMatchObject({ pct: 100, level: "bad" });
  });
});

describe("simulador (PRD 7.9)", () => {
  it("CA-20: $9,000 a 12 MSI con ingreso de $25,000 y MSI de $2,500 → de 10% a 13%", () => {
    expect(simulateInstallment({ priceCents: 900_000, months: 12, monthlyIncomeCents: 2_500_000, msiMonthlyCents: 250_000 })).toEqual({
      monthlyCents: 75_000,
      msiPctBefore: 10,
      msiPctAfter: 13,
    });
  });
});
