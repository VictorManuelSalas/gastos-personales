"use server";

import { cyclesWithCutBetween, today } from "@gp/core";
import { creditLine, cycle, db, installment, receivable, receivablePayment } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { parseWorkbook } from "@/server/import/excel";
import { buildPlan, matchLine, type ImportPreview } from "@/server/import/plan";
import { findOrCreateContact } from "@/server/finance/mutations";
import { newId } from "./util";

export type ImportState = {
  error: string | null;
  preview?: ImportPreview;
  done?: { lines: number; cycles: number; installments: number; debts: number };
  at?: number;
};

const MAX_BYTES = 5 * 1024 * 1024;

async function readFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Elige tu archivo de Excel (.xlsx)." } as const;
  if (file.size > MAX_BYTES) return { error: "El archivo pesa más de 5 MB." } as const;
  if (!/\.xlsx$/i.test(file.name)) return { error: "Solo se pueden importar archivos .xlsx. En Google Sheets: Archivo → Descargar → Excel." } as const;
  try {
    return { parsed: await parseWorkbook(await file.arrayBuffer()) } as const;
  } catch (e) {
    console.error(e);
    return { error: "No pudimos leer el archivo. Revisa que sea un Excel válido." } as const;
  }
}

async function existingLines(userId: string) {
  return db.select().from(creditLine).where(and(eq(creditLine.userId, userId), isNull(creditLine.archivedAt)));
}

/** Paso 1: lee el archivo y muestra lo que se va a importar, sin guardar nada. */
export async function previewImportAction(_p: ImportState, form: FormData): Promise<ImportState> {
  const { user } = await requireUser();
  const r = await readFile(form);
  if ("error" in r) return { error: r.error!, at: Date.now() };
  if (r.parsed.rows.length === 0) {
    return { error: "No encontramos pestañas con columnas de tarjeta, cantidad, fecha de corte y fecha límite.", at: Date.now() };
  }
  const existing = await existingLines(user.id);
  const { preview } = buildPlan(r.parsed, existing.map((l) => l.name));
  return { error: null, preview, at: Date.now() };
}

/**
 * Paso 2: importa lo seleccionado. Las tarjetas que ya existen (mismo nombre) no se
 * duplican: se les agrega el historial. Los ciclos con fecha límite pasada se marcan
 * como pagados (siempre pagas el total); los futuros quedan pendientes con su monto.
 */
export async function runImportAction(_p: ImportState, form: FormData): Promise<ImportState> {
  const { user } = await requireUser();
  const r = await readFile(form);
  if ("error" in r) return { error: r.error!, at: Date.now() };

  const existing = await existingLines(user.id);
  const plan = buildPlan(r.parsed, existing.map((l) => l.name));
  const now = today();
  const counts = { lines: 0, cycles: 0, installments: 0, debts: 0 };

  await db.transaction(async (tx) => {
    const imported: { id: string; name: string; cutDay: number }[] = [];

    for (const [index, l] of plan.lines.entries()) {
      if (form.get(`line_${index}`) !== "on") continue;
      const kind = form.get(`kind_${index}`) === "loan" ? "loan" : "card";
      const found = existing.find((e) => e.name.toLowerCase() === l.name.toLowerCase());
      const firstCut = l.cycles[0]?.cut ?? now;
      let id = found?.id;

      if (!id) {
        id = newId();
        await tx.insert(creditLine).values({
          id,
          userId: user.id,
          kind,
          name: l.name,
          cutDay: l.rule.cutDay,
          // Se respeta la regla deducida también en préstamos (p. ej. corte 16, pago día 14).
          dueKind: l.rule.due.kind,
          dueValue: l.rule.due.kind === "days_after" ? l.rule.due.days : l.rule.due.day,
          fixedPaymentCents: kind === "loan" ? (l.fixedPaymentCents ?? l.cycles.at(-1)?.amountCents ?? null) : null,
          trackingFrom: firstCut,
        });
        counts.lines++;
      }
      imported.push({ id, name: l.name, cutDay: found?.cutDay ?? l.rule.cutDay });

      // Meses sin pestaña en el Excel entre el primer y el último corte: se asumen pagados
      // (siempre pagas el total) para que no aparezcan como vencidos.
      const seen = new Set(l.cycles.map((c) => c.cut));
      const lastCut = l.cycles[l.cycles.length - 1]?.cut ?? firstCut;
      for (const gap of cyclesWithCutBetween(l.rule, firstCut, lastCut)) {
        if (seen.has(gap.cut) || gap.due >= now) continue;
        await tx
          .insert(cycle)
          .values({
            id: newId(),
            userId: user.id,
            creditLineId: id,
            cutDate: gap.cut,
            statementCents: kind === "loan" ? (l.fixedPaymentCents ?? 0) : 0,
            paidAt: gap.due,
            paidCents: kind === "loan" ? (l.fixedPaymentCents ?? 0) : 0,
            note: "Sin datos en el Excel; se asume pagado",
          })
          .onConflictDoNothing();
      }

      for (const c of l.cycles) {
        const paid = c.due < now || c.paid;
        const values = {
          statementCents: c.amountCents,
          paidAt: paid ? c.due : null,
          paidCents: paid ? c.amountCents : null,
          note: `Importado de "${c.sheet}"`,
        };
        await tx
          .insert(cycle)
          .values({ id: newId(), userId: user.id, creditLineId: id, cutDate: c.cut, ...values })
          .onConflictDoUpdate({ target: [cycle.creditLineId, cycle.cutDate], set: { ...values, updatedAt: new Date() } });
        counts.cycles++;
      }
    }

    const allLines = [...imported, ...existing.map((e) => ({ id: e.id, name: e.name, cutDay: e.cutDay }))];
    for (const [index, x] of plan.installments.entries()) {
      if (form.get(`msi_${index}`) !== "on" || !x.inferred || x.inferred.done) continue;
      const line = matchLine(x.source.bank, allLines);
      if (!line) continue;
      await tx.insert(installment).values({
        id: newId(),
        userId: user.id,
        creditLineId: line.id,
        product: x.source.product,
        priceCents: x.source.priceCents,
        months: x.source.months,
        monthlyCents: x.inferred.monthlyCents,
        firstCut: x.inferred.firstCut,
      });
      counts.installments++;
    }
  });

  // Me deben: cada renglón es un préstamo; lo abonado se registra como un abono.
  // No mueve saldos: ese dinero ya salió y regresó en el pasado.
  for (const [index, d] of r.parsed.debts.entries()) {
    if (form.get(`debt_${index}`) !== "on") continue;
    const person = await findOrCreateContact(user.id, d.name);
    const id = newId();
    const paid = Math.min(d.paidCents, d.amountCents);
    await db.insert(receivable).values({
      id,
      userId: user.id,
      contactId: person!.id,
      kind: "cash",
      concept: d.concept,
      amountCents: d.amountCents,
      date: now,
      status: paid >= d.amountCents ? "settled" : "active",
    });
    if (paid > 0) {
      await db.insert(receivablePayment).values({ id: newId(), userId: user.id, receivableId: id, amountCents: paid, date: now });
    }
    counts.debts++;
  }

  revalidatePath("/app", "layout");
  return { error: null, done: counts, at: Date.now() };
}
