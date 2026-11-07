import { describe, expect, it } from "vitest";
import { inferInstallment, inferLines, type SheetRow } from "./import";

// Fechas reales de varias pestañas del Excel (montos de ejemplo).
const row = (sheetIndex: number, name: string, cut: string, due: string, extra: Partial<SheetRow> = {}): SheetRow => ({
  sheet: `s${sheetIndex}`,
  sheetIndex,
  name,
  amountCents: 100_000,
  cut,
  due,
  paid: true,
  ...extra,
});

describe("inferLines", () => {
  const rows: SheetRow[] = [
    // BBVA: corte 10, +20 días. La pestaña "Agosto 1" tiene fechas mal copiadas.
    row(1, "BBVA", "2026-09-10", "2026-09-30"),
    row(2, "BBVA", "2026-10-10", "2026-10-30"),
    row(3, "BBVA", "2026-11-10", "2026-11-30"),
    row(0, "BBVA", "2026-07-10", "2026-09-30"),
    // Plata: corte 14, día fijo 14.
    row(1, "Plata", "2026-09-14", "2026-10-14"),
    row(2, "Plata", "2026-10-14", "2026-11-14"),
    row(3, "Plata", "2026-11-14", "2026-12-14"),
    // Stori: día fijo 2 o +20/21 días; gana la regla que reproduce más fechas.
    row(1, "Stori", "2026-09-12", "2026-10-02"),
    row(2, "Stori", "2026-10-12", "2026-11-02"),
    row(3, "Stori", "2026-11-12", "2026-12-02"),
    // KIA: préstamo por nombre.
    row(1, "KIA", "2026-09-16", "2026-10-14", { amountCents: 750_000, note: "Carro Mensualidad" }),
    row(2, "KIA", "2026-10-16", "2026-11-14", { amountCents: 750_000 }),
    row(3, "KIA", "2026-11-16", "2026-12-14", { amountCents: 750_000, paid: false }),
  ];
  const lines = Object.fromEntries(inferLines(rows).map((l) => [l.name, l]));

  it("usa los meses recientes cuando el banco cambió la fecha", () => {
    const plata = [
      row(0, "Plata", "2025-01-14", "2025-02-13"),
      row(1, "Plata", "2025-02-14", "2025-03-13"),
      row(2, "Plata", "2025-03-14", "2025-04-13"),
      row(3, "Plata", "2025-04-14", "2025-05-13"),
      ...[4, 5, 6, 7, 8, 9].map((i) => row(i, "Plata", `2026-${String(i).padStart(2, "0")}-14`, `2026-${String(i + 1).padStart(2, "0")}-14`)),
    ];
    expect(inferLines(plata)[0]!.rule.due).toEqual({ kind: "fixed_day", day: 14 });
  });

  it("en un empate entre +31 días y día fijo, gana el día fijo", () => {
    const plata = [
      row(0, "Plata", "2026-07-14", "2026-09-15"), // fechas copiadas
      row(1, "Plata", "2026-10-14", "2026-11-14"),
      row(2, "Plata", "2026-11-14", "2026-12-14"),
    ];
    expect(inferLines(plata)[0]!.rule.due).toEqual({ kind: "fixed_day", day: 14 });
  });

  it("reproduce el caso real de Plata (días límite 13, 14 y 15)", () => {
    const plata = [
      row(0, "Plata", "2026-04-14", "2026-05-13"),
      row(1, "Plata", "2026-05-14", "2026-06-15"),
      row(2, "Plata", "2026-06-14", "2026-07-15"),
      row(3, "Plata", "2026-06-14", "2026-08-15"),
      row(4, "Plata", "2026-07-14", "2026-09-15"),
      row(5, "Plata", "2026-10-14", "2026-11-14"),
      row(6, "Plata", "2026-11-14", "2026-12-14"),
    ];
    expect(inferLines(plata)[0]!.rule.due).toEqual({ kind: "fixed_day", day: 14 });
  });

  it("deduce corte y regla de fecha límite", () => {
    expect(lines.BBVA!.rule).toMatchObject({ cutDay: 10, due: { kind: "days_after", days: 20 } });
    expect(lines.Plata!.rule).toMatchObject({ cutDay: 14, due: { kind: "fixed_day", day: 14 } });
    expect(lines.Stori!.rule.due).toEqual({ kind: "fixed_day", day: 2 });
  });

  it("tolera fechas mal copiadas y lo reporta", () => {
    expect(lines.BBVA!.matches).toBe(3);
    expect(lines.BBVA!.total).toBe(4);
    expect(lines.BBVA!.notes[0]).toMatch(/En 1 de tus últimos 4 meses/);
  });

  it("detecta préstamos y su mensualidad", () => {
    expect(lines.KIA!.kind).toBe("loan");
    expect(lines.KIA!.fixedPaymentCents).toBe(750_000);
    expect(lines.BBVA!.kind).toBe("card");
  });

  it("arma un ciclo por corte con el estado de pagado", () => {
    // Préstamo: un ciclo por mes de pago, el día 14.
    expect(lines.KIA!.rule).toEqual({ cutDay: 14, due: { kind: "days_after", days: 0 } });
    expect(lines.KIA!.cycles.map((c) => [c.cut, c.paid])).toEqual([
      ["2026-10-14", true],
      ["2026-11-14", true],
      ["2026-12-14", false],
    ]);
  });
});

describe("inferInstallment", () => {
  it("ubica la primera mensualidad contando hacia atrás", () => {
    // Laptop: 18 meses, 10 abonados de $300.45; ciclo abierto con corte 10 dic 2026.
    const r = inferInstallment(
      { product: "Laptop", bank: "BBVA", priceCents: 549_900, months: 18, paidMonths: 10, paidCents: 300_450 },
      "2026-12-10",
      10,
    );
    expect(r.monthlyCents).toBe(30_045);
    expect(r.firstCut).toBe("2026-02-10");
    expect(r.done).toBe(false);
  });
});
