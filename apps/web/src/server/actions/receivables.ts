"use server";

import { category, contact, db } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { createLoan, findOrCreateContact, forgiveReceivable, recordRepayment } from "@/server/finance/mutations";
import { fail, money, ok, ownAccount, ownLine, str, type ActionState } from "./util";

async function lendingCategory(userId: string) {
  const [c] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.userId, userId), eq(category.name, "Préstamos a terceros")));
  return c?.id ?? null;
}

export async function createLoanAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "contact");
  const concept = str(f, "concept") || "Préstamo";
  const amount = money(f, "amount");
  const kind = (["cash", "purchase", "paid_for"] as const).find((k) => k === str(f, "kind")) ?? "cash";
  const [srcType, srcId] = str(f, "source").split(":");
  if (!name) return fail("¿A quién le prestaste?");
  if (amount == null) return fail("Escribe el monto.");
  const account = srcType === "a" ? await ownAccount(user.id, srcId ?? null) : null;
  const line = srcType === "c" ? await ownLine(user.id, srcId ?? null) : null;
  const person = await findOrCreateContact(user.id, name);
  await createLoan({
    userId: user.id,
    contactId: person!.id,
    kind,
    concept,
    amountCents: amount,
    accountId: account?.id ?? null,
    creditLineId: line?.id ?? null,
    categoryId: await lendingCategory(user.id),
  });
  revalidatePath("/app", "layout");
  return ok();
}

export async function repaymentAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const [person] = await db
    .select()
    .from(contact)
    .where(and(eq(contact.id, str(f, "contactId")), eq(contact.userId, user.id)));
  const amount = money(f, "amount");
  const account = await ownAccount(user.id, str(f, "accountId") || null);
  if (!person) return fail("No encontramos a esa persona.");
  if (amount == null) return fail("Escribe cuánto te abonó.");
  const r = await recordRepayment({
    userId: user.id,
    contactId: person.id,
    amountCents: amount,
    accountId: account?.id ?? null,
    receivableId: str(f, "receivableId") || undefined,
  });
  revalidatePath("/app", "layout");
  return r.extra > 0 ? fail(`Se aplicó lo que debía; sobraron ${(r.extra / 100).toFixed(2)} que no se registraron.`) : ok();
}

export async function forgiveAction(f: FormData) {
  const { user } = await requireUser();
  await forgiveReceivable(user.id, str(f, "id"), await lendingCategory(user.id));
  revalidatePath("/app", "layout");
}
