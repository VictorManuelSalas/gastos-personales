import { describe, expect, it } from "vitest";
import { goalAtRisk, goalMilestone, isUnusualExpense, summaryDue } from "./reminders";

describe("avisos de metas", () => {
  it("hitos 25/50/75/100", () => {
    expect(goalMilestone(10)).toBeNull();
    expect(goalMilestone(25)).toBe(25);
    expect(goalMilestone(62)).toBe(50);
    expect(goalMilestone(100)).toBe(100);
  });

  it("meta en riesgo", () => {
    expect(goalAtRisk({ autoCents: 100_000, suggestedCents: 150_000, paydaysLeft: 10, progress: 30 })).toBe(true);
    expect(goalAtRisk({ autoCents: 100_000, suggestedCents: 110_000, paydaysLeft: 10, progress: 30 })).toBe(false);
    expect(goalAtRisk({ autoCents: null, suggestedCents: 50_000, paydaysLeft: 4, progress: 30 })).toBe(true);
    expect(goalAtRisk({ autoCents: null, suggestedCents: 50_000, paydaysLeft: 4, progress: 100 })).toBe(false);
  });
});

describe("gasto inusual", () => {
  it("más del doble del promedio y al menos $200 arriba", () => {
    expect(isUnusualExpense(90_000, [30_000, 35_000, 25_000])).toBe(true);
    expect(isUnusualExpense(9_000, [3_000, 3_500, 2_500])).toBe(false); // solo $60 arriba
    expect(isUnusualExpense(90_000, [30_000, 35_000])).toBe(false); // pocos datos
  });
});

describe("resúmenes", () => {
  it("semanal el domingo 19:00 y mensual el día 1", () => {
    expect(summaryDue("2026-11-08", 19)).toBe("weekly"); // domingo
    expect(summaryDue("2026-11-08", 18)).toBeNull();
    expect(summaryDue("2026-12-01", 9)).toBe("monthly");
    expect(summaryDue("2026-11-10", 20)).toBeNull();
  });
});
