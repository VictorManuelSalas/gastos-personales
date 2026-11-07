import { cycleContaining, formatMXN, inferInstallment, inferLines, today, type InferredLine } from "@gp/core";
import type { ParsedWorkbook } from "./excel";

/** Resumen serializable que ve el usuario antes de importar. */
export type ImportPreview = {
  monthSheets: number;
  skippedSheets: string[];
  lines: {
    index: number;
    name: string;
    kind: "card" | "loan";
    ruleLabel: string;
    confidence: string;
    cycles: number;
    lastLabel: string;
    notes: string[];
    existing: boolean;
  }[];
  installments: { index: number; product: string; bank: string; label: string; matched: string | null; done: boolean }[];
};

const ruleLabel = (l: InferredLine) =>
  l.kind === "loan"
    ? `Pago día ${l.rule.cutDay} · ${formatMXN(l.fixedPaymentCents ?? 0)} al mes`
    : `Corte día ${l.rule.cutDay} · ${l.rule.due.kind === "days_after" ? `límite ${l.rule.due.days} días después` : `límite día ${l.rule.due.day}`}`;

/** Empata el banco de una compra a MSI con el nombre de una tarjeta ("RAPPI" → "Rappi"). */
export function matchLine<T extends { name: string }>(bank: string, lines: T[]): T | null {
  const b = bank.trim().toLowerCase();
  if (!b) return null;
  return lines.find((l) => l.name.toLowerCase() === b) ?? lines.find((l) => l.name.toLowerCase().includes(b) || b.includes(l.name.toLowerCase())) ?? null;
}

export function buildPlan(parsed: ParsedWorkbook, existingNames: string[]) {
  const lines = inferLines(parsed.rows);
  const now = today();
  const existing = new Set(existingNames.map((n) => n.toLowerCase()));

  const installments = parsed.installments.map((i) => {
    const line = matchLine(i.bank, lines.filter((l) => l.kind === "card"));
    const openCut = line ? cycleContaining(now, line.rule).cut : null;
    const inferred = line && openCut ? inferInstallment(i, openCut, line.rule.cutDay) : null;
    return { source: i, line, inferred };
  });

  const preview: ImportPreview = {
    monthSheets: parsed.monthSheets.length,
    skippedSheets: parsed.skippedSheets,
    lines: lines.map((l, index) => {
      const last = [...l.cycles].reverse().find((c) => c.amountCents > 0);
      return {
        index,
        name: l.name,
        kind: l.kind,
        ruleLabel: ruleLabel(l),
        confidence: `Coincide con ${l.matches} de tus últimos ${l.total} meses`,
        cycles: l.cycles.length,
        lastLabel: last ? `${formatMXN(last.amountCents)} · corte ${last.cut}` : "Sin montos",
        notes: l.notes,
        existing: existing.has(l.name.toLowerCase()),
      };
    }),
    installments: installments.map((x, index) => ({
      index,
      product: x.source.product,
      bank: x.source.bank,
      label: x.inferred
        ? `${formatMXN(x.inferred.monthlyCents)} al mes · ${x.source.paidMonths}/${x.source.months} pagadas · faltan ${formatMXN(x.inferred.pendingCents)}`
        : `${x.source.months} meses`,
      matched: x.line?.name ?? null,
      done: x.inferred?.done ?? false,
    })),
  };

  return { lines, installments, preview };
}
