"use server";

import { today } from "@gp/core";
import { category, db, incomeSource, moneyAccount, transaction } from "@gp/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import {
  fail,
  int,
  isoDate,
  money,
  newId,
  ok,
  optStr,
  ownAccount,
  ownCategory,
  ownLine,
  str,
  type ActionState,
} from "./util";

// ── Movimientos ───────────────────────────────────────────────────────────────

/**
 * Registra un gasto o ingreso. Con débito/efectivo mueve el saldo de la cuenta;
 * con tarjeta de crédito suma al ciclo y se paga después (RN-06).
 */
export async function createTxnAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const kind = str(f, "kind") === "income" ? "income" : "expense";
  const amount = money(f, "amount");
  const date = isoDate(f, "date") ?? today();
  const [srcType, srcId] = str(f, "source").split(":");
  const cat = await ownCategory(user.id, str(f, "categoryId") || null);
  if (amount == null) return fail("Escribe el monto, por ejemplo 65 o 1250.50.");

  const account = srcType === "a" ? await ownAccount(user.id, srcId ?? null) : null;
  const line = srcType === "c" ? await ownLine(user.id, srcId ?? null) : null;
  if (!account && !line) return fail("Elige de qué cuenta o tarjeta sale el dinero.");
  if (kind === "income" && !account) return fail("Los ingresos entran a una cuenta, no a una tarjeta.");
  if (cat && cat.kind !== kind) return fail("Esa categoría no corresponde al tipo de movimiento.");

  await db.transaction(async (tx) => {
    await tx.insert(transaction).values({
      id: newId(),
      userId: user.id,
      kind,
      amountCents: amount,
      date,
      categoryId: cat?.id ?? null,
      accountId: account?.id ?? null,
      creditLineId: line?.id ?? null,
      merchant: optStr(f, "merchant"),
      note: optStr(f, "note"),
    });
    if (account) {
      const delta = kind === "income" ? amount : -amount;
      await tx
        .update(moneyAccount)
        .set({ balanceCents: sql`${moneyAccount.balanceCents} + ${delta}` })
        .where(eq(moneyAccount.id, account.id));
    }
  });
  revalidatePath("/app", "layout");
  return ok();
}

/** Borra un movimiento y revierte su efecto en la cuenta. */
export async function deleteTxnAction(f: FormData) {
  const { user } = await requireUser();
  const id = str(f, "id");
  await db.transaction(async (tx) => {
    const [t] = await tx.select().from(transaction).where(and(eq(transaction.id, id), eq(transaction.userId, user.id)));
    if (!t || t.kind === "card_payment") return; // los pagos se deshacen desde la tarjeta
    if (t.accountId) {
      const delta = t.kind === "income" ? -t.amountCents : t.amountCents;
      await tx
        .update(moneyAccount)
        .set({ balanceCents: sql`${moneyAccount.balanceCents} + ${delta}` })
        .where(and(eq(moneyAccount.id, t.accountId), eq(moneyAccount.userId, user.id)));
    }
    await tx.delete(transaction).where(eq(transaction.id, t.id));
  });
  revalidatePath("/app", "layout");
}

// ── Fuentes de ingreso ────────────────────────────────────────────────────────

export async function createIncomeSourceAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "name");
  const expected = money(f, "expected");
  const schedule = str(f, "schedule") === "monthly" ? "monthly" : "paydays";
  const monthlyDay = schedule === "monthly" ? int(f, "monthlyDay", 1, 31) : null;
  const account = await ownAccount(user.id, str(f, "accountId") || null);
  if (!name) return fail("Ponle nombre, por ejemplo Sueldo 1.");
  if (expected == null) return fail("Escribe cuánto esperas recibir.");
  if (schedule === "monthly" && monthlyDay == null) return fail("Elige el día del mes en que cobras.");
  await db.insert(incomeSource).values({
    id: newId(),
    userId: user.id,
    name,
    expectedCents: expected,
    estimation: str(f, "estimation") === "avg3" ? "avg3" : "fixed",
    schedule,
    monthlyDay,
    accountId: account?.id ?? null,
  });
  revalidatePath("/app", "layout");
  return ok();
}

export async function archiveIncomeSourceAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(incomeSource)
    .set({ active: false })
    .where(and(eq(incomeSource.id, str(f, "id")), eq(incomeSource.userId, user.id)));
  revalidatePath("/app", "layout");
}

/** Confirma lo que realmente cayó en un día de cobro (RN-22). */
export async function confirmIncomeAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const [src] = await db
    .select()
    .from(incomeSource)
    .where(and(eq(incomeSource.id, str(f, "sourceId")), eq(incomeSource.userId, user.id)));
  const period = isoDate(f, "period");
  const amount = money(f, "amount");
  const account = await ownAccount(user.id, str(f, "accountId") || src?.accountId || null);
  if (!src || !period) return fail("No encontramos ese ingreso.");
  if (amount == null) return fail("Escribe cuánto te cayó.");
  if (!account) return fail("Elige la cuenta donde entró el dinero.");

  const [cat] = await db
    .select({ id: category.id })
    .from(category)
    .where(and(eq(category.userId, user.id), eq(category.kind, "income"), eq(category.name, "Sueldo")));

  await db.transaction(async (tx) => {
    await tx.insert(transaction).values({
      id: newId(),
      userId: user.id,
      kind: "income",
      amountCents: amount,
      date: today() < period ? today() : period,
      accountId: account.id,
      incomeSourceId: src.id,
      periodDate: period,
      categoryId: cat?.id ?? null,
      note: src.name,
    });
    await tx
      .update(moneyAccount)
      .set({ balanceCents: sql`${moneyAccount.balanceCents} + ${amount}` })
      .where(eq(moneyAccount.id, account.id));
  });
  revalidatePath("/app", "layout");
  return ok();
}

// ── Categorías ────────────────────────────────────────────────────────────────

export async function createCategoryAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "name");
  const kind = str(f, "kind") === "income" ? "income" : "expense";
  const klass = (["essential", "lifestyle", "savings"] as const).find((k) => k === str(f, "klass")) ?? "lifestyle";
  if (!name) return fail("Ponle nombre a la categoría.");
  await db.insert(category).values({
    id: newId(),
    userId: user.id,
    name,
    emoji: str(f, "emoji").slice(0, 4) || "•",
    kind,
    klass,
    isAnt: f.get("isAnt") === "on",
    sortOrder: 999,
  });
  revalidatePath("/app", "layout");
  return ok();
}

/** RN-18: no se borran categorías con historial; se archivan. */
export async function archiveCategoryAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(category)
    .set({ archivedAt: new Date() })
    .where(and(eq(category.id, str(f, "id")), eq(category.userId, user.id)));
  revalidatePath("/app", "layout");
}

export async function restoreCategoryAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(category)
    .set({ archivedAt: null })
    .where(and(eq(category.id, str(f, "id")), eq(category.userId, user.id)));
  revalidatePath("/app", "layout");
}
