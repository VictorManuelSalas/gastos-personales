"use server";

import { budget, db } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { fail, money, newId, ok, ownCategory, str, type ActionState } from "./util";

/** Crea o actualiza el tope mensual de una categoría (o de una clase 50/30/20). */
export async function setBudgetAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const amount = money(f, "amount");
  const target = str(f, "target");
  if (amount == null) return fail("Escribe el tope mensual.");
  const klass = (["essential", "lifestyle", "savings"] as const).find((k) => `class:${k}` === target) ?? null;
  const cat = klass ? null : await ownCategory(user.id, target || null);
  if (!klass && (!cat || cat.kind !== "expense")) return fail("Elige una categoría de gasto.");

  const [existing] = await db
    .select()
    .from(budget)
    .where(and(eq(budget.userId, user.id), cat ? eq(budget.categoryId, cat.id) : eq(budget.klass, klass!)));
  if (existing) await db.update(budget).set({ monthlyCents: amount }).where(eq(budget.id, existing.id));
  else await db.insert(budget).values({ id: newId(), userId: user.id, categoryId: cat?.id ?? null, klass, monthlyCents: amount });
  revalidatePath("/app/analisis");
  return ok();
}

export async function deleteBudgetAction(f: FormData) {
  const { user } = await requireUser();
  await db.delete(budget).where(and(eq(budget.id, str(f, "id")), eq(budget.userId, user.id)));
  revalidatePath("/app/analisis");
}
