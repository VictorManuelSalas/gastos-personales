"use server";

import { db, goal, moneyAccount } from "@gp/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { moveGoal } from "@/server/finance/mutations";
import { fail, int, isoDate, money, newId, ok, optMoney, ownAccount, str, type ActionState } from "./util";

async function defaultAccountId(userId: string) {
  const [a] = await db
    .select({ id: moneyAccount.id })
    .from(moneyAccount)
    .where(and(eq(moneyAccount.userId, userId), isNull(moneyAccount.archivedAt), eq(moneyAccount.inAvailable, true)))
    .orderBy(desc(moneyAccount.isDefault))
    .limit(1);
  return a?.id ?? null;
}

async function ownGoal(userId: string, id: string) {
  const [g] = await db.select().from(goal).where(and(eq(goal.id, id), eq(goal.userId, userId)));
  return g ?? null;
}

export async function createGoalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const kind = str(f, "kind") === "emergency" ? "emergency" : "goal";
  const name = str(f, "name") || (kind === "emergency" ? "Fondo de emergencia" : "");
  const target = optMoney(f, "target");
  const targetDate = isoDate(f, "targetDate");
  const auto = optMoney(f, "auto");
  const months = kind === "emergency" ? (int(f, "months", 1, 12) ?? 3) : null;
  const account = await ownAccount(user.id, str(f, "accountId") || null);
  if (!name) return fail("Ponle nombre a la meta, por ejemplo Viaje a Japón.");
  if (target === undefined || auto === undefined) return fail("Revisa los montos: escribe solo números.");
  if (kind === "goal" && !target) return fail("Escribe cuánto quieres juntar.");
  const id = newId();
  await db.insert(goal).values({
    id,
    userId: user.id,
    kind,
    name,
    emoji: str(f, "emoji").slice(0, 4) || (kind === "emergency" ? "🛟" : "🎯"),
    targetCents: target,
    targetDate,
    emergencyMonths: months,
    accountId: account?.id ?? null,
    autoCents: auto,
  });
  revalidatePath("/app", "layout");
  redirect(`/app/metas/${id}`);
}

export async function updateGoalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const g = await ownGoal(user.id, str(f, "id"));
  if (!g) return fail("No encontramos esa meta.");
  const target = optMoney(f, "target");
  const auto = optMoney(f, "auto");
  if (target === undefined || auto === undefined) return fail("Revisa los montos: escribe solo números.");
  await db
    .update(goal)
    .set({
      name: str(f, "name") || g.name,
      targetCents: target,
      targetDate: isoDate(f, "targetDate"),
      autoCents: auto,
      emergencyMonths: g.kind === "emergency" ? (int(f, "months", 1, 12) ?? g.emergencyMonths) : null,
    })
    .where(eq(goal.id, g.id));
  revalidatePath("/app", "layout");
  return ok();
}

/** Aporte manual o el aporte de una quincena (desde Mis quincenas). */
export async function contributeGoalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const g = await ownGoal(user.id, str(f, "goalId"));
  const amount = money(f, "amount");
  if (!g) return fail("No encontramos esa meta.");
  if (amount == null) return fail("Escribe cuánto vas a apartar.");
  const direction = str(f, "direction") === "out" ? -1 : 1;
  await moveGoal({
    userId: user.id,
    goalId: g.id,
    amountCents: amount * direction,
    periodDate: direction > 0 ? isoDate(f, "period") : null,
    fromAccountId: await defaultAccountId(user.id),
    note: direction > 0 ? null : "Retiro",
  });
  revalidatePath("/app", "layout");
  return ok();
}

export async function archiveGoalAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(goal)
    .set({ archivedAt: new Date() })
    .where(and(eq(goal.id, str(f, "id")), eq(goal.userId, user.id)));
  revalidatePath("/app", "layout");
  redirect("/app/metas");
}
