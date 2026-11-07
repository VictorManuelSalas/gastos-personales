import { describe, expect, it } from "vitest";
import { DEFAULT_PAYDAYS } from "./paydays";
import { emergencyTarget, paydaysUntil, progressPct, reachDate, suggestedContribution } from "./goals";
import { originalWords, parseMessage, parseSimulation } from "./messages";

const ctx = {
  lines: [
    { id: "nu", name: "NU" },
    { id: "bbva", name: "BBVA" },
    { id: "mp", name: "Mercado Pago" },
  ],
  accounts: [
    { id: "nom", name: "Nómina" },
    { id: "efe", name: "Efectivo" },
  ],
  goals: [
    { id: "jp", name: "Viaje a Japón" },
    { id: "em", name: "Fondo de emergencia" },
  ],
};

describe("lector de mensajes del bot", () => {
  it("CA-06: gasto con tarjeta", () => {
    expect(parseMessage("café 65 nu", ctx)).toEqual({ type: "expense", amountCents: 6_500, description: "cafe", source: { kind: "line", id: "nu" } });
  });

  it("gasto con tarjeta de dos palabras, preposición y miles", () => {
    expect(parseMessage("Despensa 1,250.50 con Mercado Pago", ctx)).toEqual({
      type: "expense",
      amountCents: 125_050,
      description: "despensa",
      source: { kind: "line", id: "mp" },
    });
  });

  it("gasto en efectivo y sin fuente", () => {
    expect(parseMessage("tacos 180 efectivo", ctx)).toMatchObject({ source: { kind: "account", id: "efe" } });
    expect(parseMessage("uber $95", ctx)).toMatchObject({ type: "expense", amountCents: 9_500, source: null, description: "uber" });
  });

  it("CA-07: sin monto pregunta en lugar de guardar", () => {
    expect(parseMessage("uber", ctx)).toEqual({ type: "missing_amount", description: "uber" });
  });

  it("ingreso con +", () => {
    expect(parseMessage("+1500 horas extra", ctx)).toEqual({ type: "income", amountCents: 150_000, description: "horas extra", accountId: null });
  });

  it("aporte a meta por prefijo", () => {
    expect(parseMessage("aparta 500 japon", ctx)).toMatchObject({ type: "contribution", amountCents: 50_000, goalId: "jp" });
    expect(parseMessage("ahorré 300 para emergencia", ctx)).toMatchObject({ goalId: "em" });
  });

  it("abonos y préstamos (Me deben)", () => {
    expect(parseMessage("Fer abonó 500", ctx)).toEqual({ type: "repayment", amountCents: 50_000, contactName: "fer" });
    expect(parseMessage("liz me pagó 1,000", ctx)).toMatchObject({ type: "repayment", contactName: "liz", amountCents: 100_000 });
    expect(parseMessage("presté 2000 a liz para el súper", ctx)).toEqual({
      type: "lend",
      amountCents: 200_000,
      contactName: "liz",
      description: "super",
      source: null,
    });
  });

  it("estado de cuenta explícito", () => {
    expect(parseMessage("estado bbva 4568.71", ctx)).toEqual({ type: "statement", amountCents: 456_871, lineId: "bbva", lineQuery: "bbva" });
  });

  it("recupera acentos y mayúsculas del mensaje original", () => {
    expect(originalWords("Café 65 NU", "cafe")).toBe("Café");
    expect(originalWords("Súper Chedraui 450", "super chedraui")).toBe("Súper Chedraui");
  });

  it("lee el comando del simulador", () => {
    expect(parseSimulation("/simula laptop 12000 12 msi nu", ctx.lines)).toEqual({ product: "laptop", priceCents: 1_200_000, months: 12, lineId: "nu" });
    expect(parseSimulation("/simula celular 9,000 a 18 meses con mercado pago", ctx.lines)).toMatchObject({ months: 18, lineId: "mp", priceCents: 900_000 });
  });

  it("no confunde comandos", () => {
    expect(parseMessage("/quincena", ctx)).toEqual({ type: "unknown" });
  });
});

describe("metas (RN-12, RN-14)", () => {
  it("CA-13: $15,000 con $3,000 ahorrados y 10 quincenas → $1,200", () => {
    expect(suggestedContribution(1_500_000, 300_000, 10)).toBe(120_000);
  });

  it("redondea hacia arriba a múltiplos de $50", () => {
    expect(suggestedContribution(1_000_000, 0, 7)).toBe(145_000); // 1428.57 → 1450
    expect(suggestedContribution(100_000, 100_000, 3)).toBe(0);
  });

  it("CA-15: fondo de emergencia = 3 × $15,000", () => {
    expect(emergencyTarget(1_500_000, 3)).toBe(4_500_000);
  });

  it("cuenta quincenas y proyecta la fecha", () => {
    expect(paydaysUntil(DEFAULT_PAYDAYS, "2026-11-07", "2026-12-31")).toBe(4); // 15 nov, 30 nov, 15 dic, 31 dic
    expect(reachDate(DEFAULT_PAYDAYS, "2026-11-07", 300_000, 100_000)).toBe("2026-12-15");
    expect(reachDate(DEFAULT_PAYDAYS, "2026-11-07", 300_000, null)).toBeNull();
    expect(progressPct(1_680_000, 4_000_000)).toBe(42);
  });
});
