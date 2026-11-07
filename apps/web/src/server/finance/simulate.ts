import { addDays, cycleContaining, formatMXN, simulateInstallment, today, type ISODate } from "@gp/core";
import type { InstallmentRow } from "@gp/db";
import { fmtShort } from "@/lib/dates";
import { computeHealth } from "./health";
import { loadFinance, ruleOf } from "./overview";

export type Simulation = Awaited<ReturnType<typeof simulatePurchase>>;

/**
 * Simulador "¿Me alcanza?" (PRD 7.9): agrega una compra a MSI hipotética a una
 * tarjeta y compara las próximas quincenas, el % de MSI y el disponible mínimo.
 * No guarda nada.
 */
export async function simulatePurchase(userId: string, input: { lineId: string; product: string; priceCents: number; months: number }) {
  const now = today();
  const before = await loadFinance(userId, now);
  const line = before.lines.find((l) => l.id === input.lineId && l.kind === "card");
  if (!line) return null;

  // La primera mensualidad cae en el ciclo abierto (la compra se hace hoy).
  // Si ese ciclo ya tiene estado de cuenta capturado, ya cerró: la compra entra al siguiente.
  const open = cycleContaining(now, ruleOf(line));
  const openHasStatement = before.cycleViews.some((c) => c.lineId === line.id && c.cut === open.cut && c.row?.statementCents != null);
  const firstCut: ISODate = openHasStatement ? cycleContaining(addDays(open.cut, 1), ruleOf(line)).cut : open.cut;
  const fake: InstallmentRow = {
    id: "simulacion",
    userId,
    creditLineId: line.id,
    product: input.product,
    priceCents: input.priceCents,
    months: input.months,
    monthlyCents: null,
    firstCut,
    createdAt: new Date(),
  };
  const after = await loadFinance(userId, now, { extraInstallments: [fake] });
  const health = await computeHealth(userId, before);
  const sim = simulateInstallment({
    priceCents: input.priceCents,
    months: input.months,
    monthlyIncomeCents: health.income,
    msiMonthlyCents: health.msi,
  });

  const rows = before.quincenas.map((q, i) => ({
    payday: q.payday,
    before: q.endCents,
    after: after.quincenas[i]!.endCents,
  }));
  const minBefore = Math.min(...rows.map((r) => r.before));
  const minAfter = Math.min(...rows.map((r) => r.after));
  const worst = rows.reduce((w, r) => (r.after < w.after ? r : w), rows[0]!);
  const firstCharge = after.cycleViews.find((c) => c.lineId === line.id && c.cut === firstCut);

  const verdict: { level: "good" | "warn" | "bad"; text: string } =
    minBefore < 0
      ? {
          level: "bad",
          text: `Tus quincenas ya van en negativo sin esta compra; con ella la más apretada baja otros ${formatMXN(minBefore - minAfter, { round: true })}. Primero cuadra lo que ya tienes.`,
        }
      : minAfter < 0
      ? { level: "bad", text: `No te alcanza: la quincena del ${fmtShort(worst.payday)} quedaría en negativo.` }
      : (sim.msiPctAfter ?? 0) > 20
        ? { level: "bad", text: `Te alcanza en flujo, pero tus MSI llegarían a ${sim.msiPctAfter}% de tu ingreso. Es demasiado.` }
        : (sim.msiPctAfter ?? 0) > 10
          ? { level: "warn", text: `Te alcanza, aunque tus MSI pasarían a ${sim.msiPctAfter}% de tu ingreso. Mejor si puedes esperar.` }
          : { level: "good", text: "Te alcanza y tus MSI siguen en un nivel sano." };

  return {
    line: { id: line.id, name: line.name },
    product: input.product,
    priceCents: input.priceCents,
    months: input.months,
    monthlyCents: sim.monthlyCents,
    msiPctBefore: sim.msiPctBefore,
    msiPctAfter: sim.msiPctAfter,
    firstDue: firstCharge?.due ?? null,
    firstPayday: firstCharge?.payday ?? null,
    rows,
    minBefore,
    minAfter,
    verdict,
    hasIncome: health.income > 0,
  };
}
