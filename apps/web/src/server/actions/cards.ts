"use server";

import { cutDateFor, parse, today } from "@gp/core";
import { creditLine, cycle, db, installment, moneyAccount, transaction } from "@gp/db";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { markCyclePaid } from "@/server/finance/mutations";
import { fail, int, isoDate, money, newId, ok, optMoney, ownAccount, ownLine, str, type ActionState } from "./util";

const COLORS = ["#8fa8ff", "#6fe3b5", "#f3c46b", "#ff8a8a", "#c49bff", "#5fd0f3", "#f39bd0", "#c9ccd8"];

function readLine(f: FormData) {
  const kind = str(f, "kind") === "loan" ? "loan" : "card";
  const name = str(f, "name");
  const cutDay = int(f, "cutDay", 1, 31);
  const dueKind = str(f, "dueKind") === "fixed_day" ? "fixed_day" : "days_after";
  const dueValue = dueKind === "fixed_day" ? int(f, "dueValue", 1, 31) : int(f, "dueValue", 0, 60);
  const policy = (["none", "previous", "next"] as const).find((p) => p === str(f, "policy")) ?? "none";
  const limit = optMoney(f, "creditLimit");
  const fixed = optMoney(f, "fixedPayment");
  const remaining = str(f, "remainingPayments") ? int(f, "remainingPayments", 0, 600) : null;
  const color = COLORS.includes(str(f, "color")) ? str(f, "color") : COLORS[0]!;

  if (!name) return { error: "Ponle nombre, por ejemplo BBVA Azul." };
  if (cutDay == null) return { error: kind === "loan" ? "El día de pago debe ser entre 1 y 31." : "El día de corte debe ser entre 1 y 31." };
  if (dueValue == null)
    return { error: dueKind === "fixed_day" ? "El día límite debe ser entre 1 y 31." : "Los días después del corte deben ser entre 0 y 60." };
  if (limit === undefined || fixed === undefined) return { error: "Revisa los montos: escribe solo números." };
  if (kind === "loan" && !fixed) return { error: "Escribe la mensualidad del préstamo." };
  if (remaining === undefined) return { error: "Las mensualidades restantes deben ser un número." };

  return {
    data: {
      kind,
      name,
      color,
      cutDay,
      dueKind,
      dueValue,
      businessDayPolicy: policy,
      creditLimitCents: limit,
      fixedPaymentCents: kind === "loan" ? fixed : null,
      remainingPayments: kind === "loan" ? remaining : null,
    } as const,
  };
}

export async function createLineAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = readLine(f);
  if ("error" in parsed) return fail(parsed.error!);

  // Tarjetas: desde el último corte (su pago probablemente sigue pendiente).
  // Préstamos: desde el siguiente pago (los anteriores ya se hicieron).
  const now = today();
  const { y, m } = parse(now);
  let trackingFrom = cutDateFor(y, m, parsed.data.cutDay);
  if (parsed.data.kind === "card" && trackingFrom > now) trackingFrom = cutDateFor(y, m - 1, parsed.data.cutDay);
  if (parsed.data.kind === "loan" && trackingFrom < now) trackingFrom = cutDateFor(y, m + 1, parsed.data.cutDay);

  const id = newId();
  await db.insert(creditLine).values({ id, userId: user.id, trackingFrom, ...parsed.data });
  revalidatePath("/app", "layout");
  redirect(`/app/tarjetas/${id}`);
}

export async function updateLineAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const parsed = readLine(f);
  if ("error" in parsed) return fail(parsed.error!);
  await db
    .update(creditLine)
    .set(parsed.data)
    .where(and(eq(creditLine.id, str(f, "id")), eq(creditLine.userId, user.id)));
  revalidatePath("/app", "layout");
  return ok();
}

export async function archiveLineAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(creditLine)
    .set({ archivedAt: new Date() })
    .where(and(eq(creditLine.id, str(f, "id")), eq(creditLine.userId, user.id)));
  revalidatePath("/app", "layout");
  redirect("/app/tarjetas");
}

// ── Ciclos ────────────────────────────────────────────────────────────────────

async function upsertCycle(userId: string, lineId: string, cutDate: string, patch: Partial<typeof cycle.$inferInsert>) {
  await db
    .insert(cycle)
    .values({ id: newId(), userId, creditLineId: lineId, cutDate, ...patch })
    .onConflictDoUpdate({ target: [cycle.creditLineId, cycle.cutDate], set: { ...patch, updatedAt: new Date() } });
}

/** Captura el monto del estado de cuenta y el pago mínimo (RN-05). */
export async function setStatementAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const line = await ownLine(user.id, str(f, "lineId"));
  const cut = isoDate(f, "cut");
  if (!line || !cut) return fail("No encontramos ese ciclo.");
  const statement = optMoney(f, "statement");
  const minimum = optMoney(f, "minimum");
  if (statement === undefined || minimum === undefined) return fail("Revisa los montos: escribe solo números.");
  await upsertCycle(user.id, line.id, cut, { statementCents: statement, minimumCents: minimum });
  revalidatePath("/app", "layout");
  return ok();
}

/** Marca el ciclo como pagado y descuenta el pago de la cuenta elegida. */
export async function payCycleAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const line = await ownLine(user.id, str(f, "lineId"));
  const cut = isoDate(f, "cut");
  const amount = money(f, "amount");
  const paidAt = isoDate(f, "paidAt") ?? today();
  const account = await ownAccount(user.id, str(f, "accountId") || null);
  if (!line || !cut) return fail("No encontramos ese ciclo.");
  if (amount == null) return fail("Escribe cuánto pagaste.");

  await markCyclePaid({ userId: user.id, line, cut, amountCents: amount, accountId: account?.id ?? null, paidAt });
  revalidatePath("/app", "layout");
  return ok();
}

/** Deshace un pago: borra el movimiento y regresa el dinero a la cuenta. */
export async function unpayCycleAction(f: FormData) {
  const { user } = await requireUser();
  const line = await ownLine(user.id, str(f, "lineId"));
  const cut = isoDate(f, "cut");
  if (!line || !cut) return;
  await db.transaction(async (tx) => {
    const payments = await tx
      .select()
      .from(transaction)
      .where(
        and(
          eq(transaction.userId, user.id),
          eq(transaction.kind, "card_payment"),
          eq(transaction.creditLineId, line.id),
          eq(transaction.periodDate, cut),
        ),
      );
    for (const p of payments) {
      if (p.accountId) {
        await tx
          .update(moneyAccount)
          .set({ balanceCents: sql`${moneyAccount.balanceCents} + ${p.amountCents}` })
          .where(and(eq(moneyAccount.id, p.accountId), eq(moneyAccount.userId, user.id)));
      }
      await tx.delete(transaction).where(eq(transaction.id, p.id));
    }
    await tx
      .update(cycle)
      .set({ paidAt: null, paidCents: null, updatedAt: new Date() })
      .where(and(eq(cycle.creditLineId, line.id), eq(cycle.cutDate, cut)));
  });
  revalidatePath("/app", "layout");
}

/** Mueve un pago a otra quincena, o lo regresa a la calculada (RN-04). */
export async function movePaydayAction(f: FormData) {
  const { user } = await requireUser();
  const line = await ownLine(user.id, str(f, "lineId"));
  const cut = isoDate(f, "cut");
  if (!line || !cut) return;
  await upsertCycle(user.id, line.id, cut, { paydayOverride: isoDate(f, "payday") });
  revalidatePath("/app", "layout");
}

// ── MSI ───────────────────────────────────────────────────────────────────────

export async function createInstallmentAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const line = await ownLine(user.id, str(f, "lineId"));
  const product = str(f, "product");
  const price = money(f, "price");
  const months = int(f, "months", 2, 60);
  const monthly = optMoney(f, "monthly");
  const firstCut = isoDate(f, "firstCut");
  if (!line || line.kind !== "card") return fail("Elige una tarjeta.");
  if (!product) return fail("¿Qué compraste? Ponle un nombre.");
  if (price == null) return fail("Escribe el precio total.");
  if (months == null) return fail("Los meses deben ser entre 2 y 60.");
  if (monthly === undefined) return fail("Revisa la mensualidad: escribe solo números.");
  if (!firstCut) return fail("Elige el corte de la primera mensualidad.");
  await db.insert(installment).values({
    id: newId(),
    userId: user.id,
    creditLineId: line.id,
    product,
    priceCents: price,
    months,
    monthlyCents: monthly,
    firstCut,
  });
  revalidatePath("/app", "layout");
  return ok();
}

export async function deleteInstallmentAction(f: FormData) {
  const { user } = await requireUser();
  await db.delete(installment).where(and(eq(installment.id, str(f, "id")), eq(installment.userId, user.id)));
  revalidatePath("/app", "layout");
}
