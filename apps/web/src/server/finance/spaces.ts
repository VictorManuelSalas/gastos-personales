import { settleUp, spaceBalances, splitEqually, today, type SharedEntry } from "@gp/core";
import { db, sharedExpense, sharedShare, space, spaceGoal, spaceGoalContribution, spaceMember, user } from "@gp/db";
import { and, desc, eq, inArray } from "drizzle-orm";
import { newId } from "@/server/actions/util";

/**
 * Espacios compartidos (RF-39). Única excepción al aislamiento (RN-09): los miembros
 * ven los gastos del espacio, nunca las finanzas personales de los demás.
 */

export async function isMember(spaceId: string, userId: string) {
  const [m] = await db.select().from(spaceMember).where(and(eq(spaceMember.spaceId, spaceId), eq(spaceMember.userId, userId)));
  return Boolean(m);
}

export async function mySpaces(userId: string) {
  const rows = await db
    .select({ id: space.id, name: space.name, createdAt: space.createdAt })
    .from(spaceMember)
    .innerJoin(space, eq(spaceMember.spaceId, space.id))
    .where(eq(spaceMember.userId, userId))
    .orderBy(desc(space.createdAt));
  const out = [];
  for (const s of rows) {
    const d = await spaceDetail(s.id, userId);
    if (d) out.push({ ...s, members: d.members.length, myBalance: d.balances.get(userId) ?? 0 });
  }
  return out;
}

export async function spaceDetail(spaceId: string, userId: string) {
  if (!(await isMember(spaceId, userId))) return null;
  const [sp] = await db.select().from(space).where(eq(space.id, spaceId));
  const members = await db
    .select({ id: user.id, name: user.name, email: user.email })
    .from(spaceMember)
    .innerJoin(user, eq(spaceMember.userId, user.id))
    .where(eq(spaceMember.spaceId, spaceId));
  const expenses = await db.select().from(sharedExpense).where(eq(sharedExpense.spaceId, spaceId)).orderBy(desc(sharedExpense.date), desc(sharedExpense.createdAt));
  const shares = expenses.length
    ? await db.select().from(sharedShare).where(inArray(sharedShare.expenseId, expenses.map((e) => e.id)))
    : [];
  const entries: SharedEntry[] = expenses.map((e) =>
    e.kind === "settlement"
      ? { kind: "settlement", paidBy: e.paidBy, paidTo: e.paidTo!, amountCents: e.amountCents }
      : { kind: "expense", paidBy: e.paidBy, amountCents: e.amountCents, shares: shares.filter((s) => s.expenseId === e.id) },
  );
  const balances = spaceBalances(entries, members.map((m) => m.id));
  const goals = await db.select().from(spaceGoal).where(eq(spaceGoal.spaceId, spaceId));
  const contributions = goals.length
    ? await db.select().from(spaceGoalContribution).where(inArray(spaceGoalContribution.goalId, goals.map((g) => g.id)))
    : [];
  return {
    space: sp!,
    members,
    expenses,
    shares,
    balances,
    transfers: settleUp(balances),
    goals: goals.map((g) => {
      const mine = contributions.filter((c) => c.goalId === g.id);
      return {
        ...g,
        savedCents: mine.reduce((s, c) => s + c.amountCents, 0),
        byMember: members.map((m) => ({ ...m, cents: mine.filter((c) => c.userId === m.id).reduce((s, c) => s + c.amountCents, 0) })),
      };
    }),
  };
}

export async function addSharedExpense(o: { spaceId: string; paidBy: string; concept: string; amountCents: number; participants: string[] }) {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(sharedExpense).values({ id, spaceId: o.spaceId, paidBy: o.paidBy, concept: o.concept, amountCents: o.amountCents, date: today() });
    await tx.insert(sharedShare).values(splitEqually(o.amountCents, o.participants).map((s) => ({ expenseId: id, ...s })));
  });
  return id;
}
