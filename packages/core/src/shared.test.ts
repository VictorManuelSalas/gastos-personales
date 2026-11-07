import { describe, expect, it } from "vitest";
import { paybackMonths, settleUp, spaceBalances, splitEqually } from "./shared";

describe("espacios compartidos (RF-39)", () => {
  it("reparte en partes iguales sin perder centavos", () => {
    expect(splitEqually(100_000, ["a", "b", "c"])).toEqual([
      { userId: "a", shareCents: 33_334 },
      { userId: "b", shareCents: 33_333 },
      { userId: "c", shareCents: 33_333 },
    ]);
  });

  it("servicios ÷ 2: quién le debe a quién", () => {
    const entries = [
      { kind: "expense" as const, paidBy: "victor", amountCents: 63_000, shares: splitEqually(63_000, ["victor", "ana"]) },
      { kind: "expense" as const, paidBy: "ana", amountCents: 19_000, shares: splitEqually(19_000, ["victor", "ana"]) },
    ];
    const bal = spaceBalances(entries, ["victor", "ana"]);
    expect(bal.get("victor")).toBe(22_000);
    expect(bal.get("ana")).toBe(-22_000);
    expect(settleUp(bal)).toEqual([{ from: "ana", to: "victor", amountCents: 22_000 }]);
  });

  it("un pago para saldar deja a todos en cero", () => {
    const entries = [
      { kind: "expense" as const, paidBy: "a", amountCents: 90_000, shares: splitEqually(90_000, ["a", "b", "c"]) },
      { kind: "settlement" as const, paidBy: "b", paidTo: "a", amountCents: 30_000 },
      { kind: "settlement" as const, paidBy: "c", paidTo: "a", amountCents: 30_000 },
    ];
    const bal = spaceBalances(entries, ["a", "b", "c"]);
    expect([...bal.values()]).toEqual([0, 0, 0]);
    expect(settleUp(bal)).toEqual([]);
  });
});

describe("proyectos (RF-40)", () => {
  it("meses para recuperar la inversión", () => {
    expect(paybackMonths(415_800, 106_000)).toBe(3.9);
    expect(paybackMonths(415_800, 0)).toBeNull();
    expect(paybackMonths(0, 1)).toBe(0);
  });
});
