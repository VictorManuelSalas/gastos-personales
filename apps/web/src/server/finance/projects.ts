import { monthStart, paybackMonths, today } from "@gp/core";
import { db, project, projectClient, transaction, transactionTag } from "@gp/db";
import { and, eq, gte, isNull } from "drizzle-orm";

/**
 * Proyectos o negocios (RF-40): ingresos y costos son los movimientos con la etiqueta
 * del proyecto; así quedan separados de lo personal pero dentro de tus cuentas.
 */
export async function loadProjects(userId: string) {
  const projects = await db.select().from(project).where(and(eq(project.userId, userId), isNull(project.archivedAt))).orderBy(project.createdAt);
  return Promise.all(projects.map((p) => projectSummary(userId, p.id)));
}

export async function projectSummary(userId: string, projectId: string) {
  const [p] = await db.select().from(project).where(and(eq(project.id, projectId), eq(project.userId, userId)));
  if (!p) return null;
  const since = monthStart(today(), -11);
  const [clients, rows] = await Promise.all([
    db.select().from(projectClient).where(eq(projectClient.projectId, p.id)).orderBy(projectClient.name),
    db
      .select({ id: transaction.id, kind: transaction.kind, amount: transaction.amountCents, date: transaction.date, merchant: transaction.merchant, period: transaction.periodDate })
      .from(transactionTag)
      .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id))
      .where(and(eq(transactionTag.tagId, p.tagId), eq(transaction.userId, userId), gte(transaction.date, since))),
  ]);

  const months = Array.from({ length: 6 }, (_, i) => {
    const m = monthStart(today(), i - 5);
    const next = monthStart(today(), i - 4);
    const inM = rows.filter((r) => r.date >= m && r.date < next);
    const income = inM.filter((r) => r.kind === "income").reduce((s, r) => s + r.amount, 0);
    const costs = inM.filter((r) => r.kind === "expense").reduce((s, r) => s + r.amount, 0);
    return { month: m, income, costs, profit: income - costs };
  });
  const withData = months.filter((m) => m.income || m.costs);
  const avgProfit = withData.length ? Math.round(withData.reduce((s, m) => s + m.profit, 0) / withData.length) : 0;
  const totalProfit = rows.reduce((s, r) => s + (r.kind === "income" ? r.amount : r.kind === "expense" ? -r.amount : 0), 0);
  const thisMonth = monthStart(today());
  const charged = new Set(rows.filter((r) => r.kind === "income" && r.period === thisMonth).map((r) => r.merchant));
  const activeClients = clients.filter((c) => c.active);

  return {
    project: p,
    clients: clients.map((c) => ({ ...c, chargedThisMonth: charged.has(c.name) })),
    months,
    avgProfitCents: avgProfit,
    totalProfitCents: totalProfit,
    expectedMonthlyCents: activeClients.reduce((s, c) => s + c.monthlyCents, 0),
    paybackMonths: paybackMonths(p.investmentCents, avgProfit),
    recoveredCents: Math.max(0, totalProfit),
  };
}
