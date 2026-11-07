import {
  emergencyTarget,
  monthStart,
  paydaysUntil,
  progressPct,
  reachDate,
  suggestedContribution,
  type ISODate,
  type PaydayRule,
} from "@gp/core";
import { category, db, goal, goalMovement, moneyAccount, transaction, type Goal, type GoalMovement } from "@gp/db";
import { and, eq, gte, isNull, lt } from "drizzle-orm";

export type GoalView = Goal & {
  savedCents: number;
  targetCents: number | null;
  /** El objetivo del fondo de emergencia se calcula con tus gastos (RN-14). */
  targetComputed: boolean;
  progress: number;
  suggestedCents: number | null;
  paydaysLeft: number | null;
  reachDate: ISODate | null;
  /** Apartado virtual: el dinero sigue en tus cuentas y se descuenta del disponible (RN-13). */
  virtual: boolean;
  movements: GoalMovement[];
};

/** Gasto esencial mensual promedio de los últimos 3 meses completos. */
export async function avgEssentialMonthly(userId: string, now: ISODate) {
  const rows = await db
    .select({ amount: transaction.amountCents })
    .from(transaction)
    .innerJoin(category, eq(transaction.categoryId, category.id))
    .where(
      and(
        eq(transaction.userId, userId),
        eq(transaction.kind, "expense"),
        eq(category.klass, "essential"),
        gte(transaction.date, monthStart(now, -3)),
        lt(transaction.date, monthStart(now)),
      ),
    );
  return Math.round(rows.reduce((s, r) => s + r.amount, 0) / 3);
}

export async function loadGoals(userId: string, rule: PaydayRule, now: ISODate): Promise<GoalView[]> {
  const [goals, movements, accounts] = await Promise.all([
    db.select().from(goal).where(and(eq(goal.userId, userId), isNull(goal.archivedAt))).orderBy(goal.createdAt),
    db.select().from(goalMovement).where(eq(goalMovement.userId, userId)),
    db.select({ id: moneyAccount.id, inAvailable: moneyAccount.inAvailable }).from(moneyAccount).where(eq(moneyAccount.userId, userId)),
  ]);
  const needsAvg = goals.some((g) => g.kind === "emergency" && g.targetCents == null);
  const avg = needsAvg ? await avgEssentialMonthly(userId, now) : 0;

  return goals.map((g) => {
    const mine = movements.filter((m) => m.goalId === g.id).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    const savedCents = mine.reduce((s, m) => s + m.amountCents, 0);
    const computed = g.kind === "emergency" && g.targetCents == null && avg > 0;
    const targetCents = g.targetCents ?? (computed ? emergencyTarget(avg, g.emergencyMonths ?? 3) : null);
    const paydaysLeft = g.targetDate ? paydaysUntil(rule, now, g.targetDate) : null;
    const suggestedCents = targetCents != null && paydaysLeft ? suggestedContribution(targetCents, savedCents, paydaysLeft) : null;
    const account = accounts.find((a) => a.id === g.accountId);
    return {
      ...g,
      savedCents,
      targetCents,
      targetComputed: computed,
      progress: progressPct(savedCents, targetCents),
      suggestedCents,
      paydaysLeft,
      reachDate: targetCents != null ? reachDate(rule, now, targetCents - savedCents, g.autoCents ?? suggestedCents) : null,
      virtual: !account || account.inAvailable,
      movements: mine,
    };
  });
}
