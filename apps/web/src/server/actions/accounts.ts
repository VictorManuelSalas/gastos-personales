"use server";

import { db, moneyAccount, quincenaClose } from "@gp/db";
import { and, eq, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { fail, newId, ok, optMoney, str, type ActionState } from "./util";

const KINDS = ["debit", "cash", "savings"] as const;

export async function createAccountAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "name");
  const kind = str(f, "kind") as (typeof KINDS)[number];
  const balance = optMoney(f, "balance");
  if (!name) return fail("Ponle nombre a la cuenta.");
  if (!KINDS.includes(kind)) return fail("Elige el tipo de cuenta.");
  if (balance === undefined) return fail("Revisa el saldo: escribe solo números, por ejemplo 12500.50.");

  const [{ n } = { n: 0 }] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(moneyAccount)
    .where(eq(moneyAccount.userId, user.id));

  await db.insert(moneyAccount).values({
    id: newId(),
    userId: user.id,
    name,
    kind,
    balanceCents: balance ?? 0,
    inAvailable: kind !== "savings",
    isDefault: n === 0,
  });
  revalidatePath("/app", "layout");
  return ok();
}

export async function updateAccountAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const id = str(f, "id");
  const name = str(f, "name");
  const balance = optMoney(f, "balance");
  if (!name) return fail("Ponle nombre a la cuenta.");
  if (balance == null) return fail("Escribe el saldo actual de la cuenta.");
  await db
    .update(moneyAccount)
    .set({ name, balanceCents: balance, inAvailable: f.get("inAvailable") === "on" })
    .where(and(eq(moneyAccount.id, id), eq(moneyAccount.userId, user.id)));
  revalidatePath("/app", "layout");
  return ok();
}

export async function setDefaultAccountAction(f: FormData) {
  const { user } = await requireUser();
  const id = str(f, "id");
  await db.transaction(async (tx) => {
    await tx.update(moneyAccount).set({ isDefault: false }).where(eq(moneyAccount.userId, user.id));
    await tx.update(moneyAccount).set({ isDefault: true }).where(and(eq(moneyAccount.id, id), eq(moneyAccount.userId, user.id)));
  });
  revalidatePath("/app", "layout");
}

export async function archiveAccountAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(moneyAccount)
    .set({ archivedAt: new Date(), isDefault: false })
    .where(and(eq(moneyAccount.id, str(f, "id")), eq(moneyAccount.userId, user.id)));
  revalidatePath("/app", "layout");
}

/**
 * Cierre de quincena (PRD 7.10): el usuario confirma o corrige el saldo real de cada
 * cuenta; se guarda la diferencia contra lo que la app calculaba.
 */
export async function closeQuincenaAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const payday = str(f, "payday");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(payday)) return fail("Quincena inválida.");
  const accounts = await db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt)));
  let expected = 0;
  let actual = 0;
  const updates: { id: string; cents: number }[] = [];
  for (const a of accounts) {
    const raw = optMoney(f, `balance_${a.id}`);
    if (raw === undefined) return fail(`Revisa el saldo de ${a.name}.`);
    expected += a.balanceCents;
    const value = raw ?? a.balanceCents;
    actual += value;
    if (value !== a.balanceCents) updates.push({ id: a.id, cents: value });
  }
  await db.transaction(async (tx) => {
    for (const u of updates) await tx.update(moneyAccount).set({ balanceCents: u.cents }).where(eq(moneyAccount.id, u.id));
    await tx
      .insert(quincenaClose)
      .values({ id: newId(), userId: user.id, payday, expectedCents: expected, actualCents: actual })
      .onConflictDoNothing();
  });
  revalidatePath("/app", "layout");
  return ok();
}
