"use server";

import { category, db, recurringBill } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { payBill } from "@/server/finance/bills";
import { findOrCreateContact } from "@/server/finance/mutations";
import { fail, int, isoDate, money, newId, ok, ownAccount, ownCategory, ownLine, str, type ActionState } from "./util";

export async function createBillAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "name");
  const amount = money(f, "amount");
  const day = int(f, "day", 1, 31);
  const every = int(f, "every", 1, 12) ?? 1;
  const kind = str(f, "kind") === "subscription" ? "subscription" : "service";
  const [srcType, srcId] = str(f, "source").split(":");
  const parts = int(f, "splitParts", 1, 10) ?? 1;
  const splitName = str(f, "splitWith");
  if (!name) return fail("Ponle nombre, por ejemplo Internet o Netflix.");
  if (amount == null) return fail("Escribe el monto aproximado.");
  if (day == null) return fail("El día de cobro debe ser entre 1 y 31.");
  if (parts > 1 && !splitName) return fail("¿Con quién lo divides?");

  const account = srcType === "a" ? await ownAccount(user.id, srcId ?? null) : null;
  const line = srcType === "c" ? await ownLine(user.id, srcId ?? null) : null;
  const cat = await ownCategory(user.id, str(f, "categoryId") || null);
  const contact = parts > 1 ? await findOrCreateContact(user.id, splitName) : null;
  const anchor = every > 1 ? (int(f, "anchor", 1, 12) ?? new Date().getMonth() + 1) : null;

  await db.insert(recurringBill).values({
    id: newId(),
    userId: user.id,
    kind,
    name,
    amountCents: amount,
    dayOfMonth: day,
    everyMonths: every,
    anchorMonth: anchor,
    accountId: account?.id ?? null,
    creditLineId: line?.id ?? null,
    categoryId: cat?.id ?? null,
    splitContactId: contact?.id ?? null,
    splitParts: parts,
  });
  revalidatePath("/app", "layout");
  return ok();
}

/** Pago desde Mis quincenas o la pantalla de servicios. */
export async function payBillAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const [bill] = await db
    .select()
    .from(recurringBill)
    .where(and(eq(recurringBill.id, str(f, "billId")), eq(recurringBill.userId, user.id)));
  const period = isoDate(f, "period");
  const amount = money(f, "amount");
  const account = await ownAccount(user.id, str(f, "accountId") || bill?.accountId || null);
  if (!bill || !period) return fail("No encontramos ese servicio.");
  if (amount == null) return fail("Escribe cuánto pagaste.");
  const [lending] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.userId, user.id), eq(category.name, "Préstamos a terceros")));
  await payBill({ userId: user.id, bill, period, amountCents: amount, accountId: account?.id ?? null, lendingCategoryId: lending?.id ?? null });
  revalidatePath("/app", "layout");
  return ok();
}

export async function archiveBillAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(recurringBill)
    .set({ active: false })
    .where(and(eq(recurringBill.id, str(f, "id")), eq(recurringBill.userId, user.id)));
  revalidatePath("/app", "layout");
}
