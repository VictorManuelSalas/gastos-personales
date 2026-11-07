import { category, contact, creditLine, cycle, db, goal, goalMovement, moneyAccount, recurringBill, transaction } from "@gp/db";
import { desc, eq } from "drizzle-orm";
import ExcelJS from "exceljs";
import { getSession } from "@/lib/session";
import { receivableBalances } from "@/server/finance/mutations";

export const dynamic = "force-dynamic";

const pesos = (c: number | null | undefined) => (c == null ? null : c / 100);

/** RF-36: todos tus datos en un Excel (solo los tuyos, RN-09). */
export async function GET() {
  const s = await getSession();
  if (!s) return new Response("No autorizado", { status: 401 });
  const userId = s.user.id;

  const [txns, cats, accounts, lines, cycles, goals, moves, people, rec, bills] = await Promise.all([
    db.select().from(transaction).where(eq(transaction.userId, userId)).orderBy(desc(transaction.date)),
    db.select().from(category).where(eq(category.userId, userId)),
    db.select().from(moneyAccount).where(eq(moneyAccount.userId, userId)),
    db.select().from(creditLine).where(eq(creditLine.userId, userId)),
    db.select().from(cycle).where(eq(cycle.userId, userId)).orderBy(desc(cycle.cutDate)),
    db.select().from(goal).where(eq(goal.userId, userId)),
    db.select().from(goalMovement).where(eq(goalMovement.userId, userId)),
    db.select().from(contact).where(eq(contact.userId, userId)),
    receivableBalances(userId),
    db.select().from(recurringBill).where(eq(recurringBill.userId, userId)),
  ]);
  const name = <T extends { id: string; name: string }>(list: T[], id: string | null) => list.find((x) => x.id === id)?.name ?? "";

  const wb = new ExcelJS.Workbook();
  wb.creator = "Quincena";
  const sheet = (title: string, columns: { header: string; key: string; width?: number }[], rows: Record<string, unknown>[]) => {
    const ws = wb.addWorksheet(title);
    ws.columns = columns.map((c) => ({ ...c, width: c.width ?? 16 }));
    ws.addRows(rows);
    ws.getRow(1).font = { bold: true };
    ws.views = [{ state: "frozen", ySplit: 1 }];
  };

  sheet(
    "Movimientos",
    [
      { header: "Fecha", key: "date", width: 12 },
      { header: "Tipo", key: "kind", width: 14 },
      { header: "Monto", key: "amount", width: 12 },
      { header: "Comercio / nota", key: "merchant", width: 28 },
      { header: "Categoría", key: "cat", width: 22 },
      { header: "Cuenta", key: "account" },
      { header: "Tarjeta", key: "line" },
      { header: "Origen", key: "origin", width: 10 },
    ],
    txns.map((t) => ({
      date: t.date,
      kind: { expense: "Gasto", income: "Ingreso", card_payment: "Pago de tarjeta", adjustment: "Ajuste" }[t.kind],
      amount: pesos(t.amountCents),
      merchant: t.merchant ?? t.note ?? "",
      cat: name(cats, t.categoryId),
      account: name(accounts, t.accountId),
      line: name(lines, t.creditLineId),
      origin: t.origin,
    })),
  );
  sheet(
    "Ciclos",
    [
      { header: "Tarjeta", key: "line" },
      { header: "Corte", key: "cut", width: 12 },
      { header: "Estado de cuenta", key: "statement" },
      { header: "Pagado el", key: "paidAt", width: 12 },
      { header: "Monto pagado", key: "paid" },
    ],
    cycles.map((c) => ({ line: name(lines, c.creditLineId), cut: c.cutDate, statement: pesos(c.statementCents), paidAt: c.paidAt ?? "", paid: pesos(c.paidCents) })),
  );
  sheet(
    "Metas",
    [
      { header: "Meta", key: "name", width: 24 },
      { header: "Objetivo", key: "target" },
      { header: "Ahorrado", key: "saved" },
      { header: "Fecha objetivo", key: "date", width: 14 },
    ],
    goals.map((g) => ({
      name: g.name,
      target: pesos(g.targetCents),
      saved: pesos(moves.filter((m) => m.goalId === g.id).reduce((s, m) => s + m.amountCents, 0)),
      date: g.targetDate ?? "",
    })),
  );
  sheet(
    "Me deben",
    [
      { header: "Persona", key: "person" },
      { header: "Concepto", key: "concept", width: 28 },
      { header: "Monto", key: "amount" },
      { header: "Abonado", key: "paid" },
      { header: "Pendiente", key: "pending" },
      { header: "Estado", key: "status" },
    ],
    rec.map((r) => ({
      person: name(people, r.contactId),
      concept: r.concept,
      amount: pesos(r.amountCents),
      paid: pesos(r.paidCents),
      pending: pesos(r.pendingCents),
      status: { active: "Activo", settled: "Liquidado", forgiven: "Incobrable" }[r.status],
    })),
  );
  sheet(
    "Servicios",
    [
      { header: "Nombre", key: "name", width: 22 },
      { header: "Tipo", key: "kind" },
      { header: "Monto", key: "amount" },
      { header: "Día", key: "day", width: 8 },
      { header: "Cada (meses)", key: "every", width: 12 },
    ],
    bills.map((b) => ({ name: b.name, kind: b.kind === "service" ? "Servicio" : "Suscripción", amount: pesos(b.amountCents), day: b.dayOfMonth, every: b.everyMonths })),
  );

  const buf = await wb.xlsx.writeBuffer();
  const date = new Date().toISOString().slice(0, 10);
  return new Response(buf, {
    headers: {
      "content-type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "content-disposition": `attachment; filename="quincena-${date}.xlsx"`,
      "cache-control": "no-store",
    },
  });
}
