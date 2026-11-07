import { today } from "@gp/core";
import {
  contact,
  cycle,
  db,
  goal,
  goalMovement,
  moneyAccount,
  receivable,
  receivablePayment,
  transaction,
  type CreditLine,
} from "@gp/db";
import { and, eq, sql } from "drizzle-orm";
import { newId } from "@/server/actions/util";

/**
 * Marca un ciclo como pagado: guarda el pago, crea el movimiento y, si hay cuenta,
 * descuenta el dinero (RN-06). Lo usan la web y el botón "Ya pagué" de Telegram.
 */
export async function markCyclePaid(opts: {
  userId: string;
  line: CreditLine;
  cut: string;
  amountCents: number;
  accountId: string | null;
  paidAt?: string;
}) {
  const paidAt = opts.paidAt ?? today();
  await db.transaction(async (tx) => {
    await tx
      .insert(cycle)
      .values({ id: newId(), userId: opts.userId, creditLineId: opts.line.id, cutDate: opts.cut, paidAt, paidCents: opts.amountCents })
      .onConflictDoUpdate({
        target: [cycle.creditLineId, cycle.cutDate],
        set: { paidAt, paidCents: opts.amountCents, updatedAt: new Date() },
      });
    await tx.insert(transaction).values({
      id: newId(),
      userId: opts.userId,
      kind: "card_payment",
      amountCents: opts.amountCents,
      date: paidAt,
      accountId: opts.accountId,
      creditLineId: opts.line.id,
      periodDate: opts.cut,
      note: `Pago ${opts.line.name}`,
    });
    if (opts.accountId) {
      await tx
        .update(moneyAccount)
        .set({ balanceCents: sql`${moneyAccount.balanceCents} - ${opts.amountCents}` })
        .where(eq(moneyAccount.id, opts.accountId));
    }
  });
}

// ── Movimientos, metas y Me deben (compartido por la web y el bot) ─────────────

type Db = typeof db;
type Tx = Parameters<Parameters<Db["transaction"]>[0]>[0];

async function moveBalance(tx: Tx | Db, accountId: string | null | undefined, deltaCents: number) {
  if (!accountId || deltaCents === 0) return;
  await tx
    .update(moneyAccount)
    .set({ balanceCents: sql`${moneyAccount.balanceCents} + ${deltaCents}` })
    .where(eq(moneyAccount.id, accountId));
}

/**
 * Registra un gasto o ingreso. Débito/efectivo mueve el saldo de la cuenta;
 * tarjeta de crédito suma al ciclo y se paga después (RN-06).
 */
export async function recordTransaction(o: {
  userId: string;
  kind: "expense" | "income";
  amountCents: number;
  date?: string;
  categoryId?: string | null;
  accountId?: string | null;
  creditLineId?: string | null;
  merchant?: string | null;
  note?: string | null;
  origin?: "web" | "telegram";
}) {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(transaction).values({
      id,
      userId: o.userId,
      kind: o.kind,
      amountCents: o.amountCents,
      date: o.date ?? today(),
      categoryId: o.categoryId ?? null,
      accountId: o.accountId ?? null,
      creditLineId: o.creditLineId ?? null,
      merchant: o.merchant ?? null,
      note: o.note ?? null,
      origin: o.origin ?? "web",
    });
    await moveBalance(tx, o.accountId, o.kind === "income" ? o.amountCents : -o.amountCents);
  });
  return id;
}

/** Borra un gasto o ingreso y revierte su efecto en la cuenta. */
export async function deleteTransaction(userId: string, id: string) {
  return db.transaction(async (tx) => {
    const [t] = await tx.select().from(transaction).where(and(eq(transaction.id, id), eq(transaction.userId, userId)));
    if (!t || t.kind === "card_payment") return null;
    await moveBalance(tx, t.accountId, t.kind === "income" ? -t.amountCents : t.amountCents);
    await tx.delete(transaction).where(eq(transaction.id, t.id));
    return t;
  });
}

/**
 * Aporte (+) o retiro (−) de una meta. Si la meta vive en una cuenta real, el dinero
 * se mueve entre la cuenta principal y esa cuenta; si es apartado virtual, solo se anota.
 */
export async function moveGoal(o: {
  userId: string;
  goalId: string;
  amountCents: number;
  periodDate?: string | null;
  fromAccountId?: string | null;
  note?: string | null;
  origin?: "web" | "telegram";
}) {
  await db.transaction(async (tx) => {
    const [g] = await tx.select().from(goal).where(and(eq(goal.id, o.goalId), eq(goal.userId, o.userId)));
    if (!g) throw new Error("Meta no encontrada");
    await tx.insert(goalMovement).values({
      id: newId(),
      userId: o.userId,
      goalId: g.id,
      amountCents: o.amountCents,
      date: today(),
      periodDate: o.periodDate ?? null,
      note: o.note ?? null,
      origin: o.origin ?? "web",
    });
    if (g.accountId && o.fromAccountId && g.accountId !== o.fromAccountId) {
      await moveBalance(tx, o.fromAccountId, -o.amountCents);
      await moveBalance(tx, g.accountId, o.amountCents);
    }
  });
}

/** Busca un contacto por nombre (exacto o prefijo) o lo crea. */
export async function findOrCreateContact(userId: string, name: string, create = true) {
  const list = await db.select().from(contact).where(eq(contact.userId, userId));
  const n = name.trim().toLowerCase();
  const hit = list.find((c) => c.name.toLowerCase() === n) ?? list.find((c) => c.name.toLowerCase().startsWith(n));
  if (hit || !create) return hit ?? null;
  const [c] = await db
    .insert(contact)
    .values({ id: newId(), userId, name: name.trim().replace(/^\w/, (ch) => ch.toUpperCase()) })
    .returning();
  return c!;
}

/**
 * Presta dinero o registra una compra a nombre de otra persona (PRD 7.12).
 * Con cuenta, el dinero sale de ella. Con tarjeta, se registra un gasto en su ciclo.
 */
export async function createLoan(o: {
  userId: string;
  contactId: string;
  kind: "cash" | "purchase" | "paid_for";
  concept: string;
  amountCents: number;
  accountId?: string | null;
  creditLineId?: string | null;
  categoryId?: string | null;
}) {
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(receivable).values({
      id,
      userId: o.userId,
      contactId: o.contactId,
      kind: o.kind,
      concept: o.concept,
      amountCents: o.amountCents,
      date: today(),
      accountId: o.accountId ?? null,
      creditLineId: o.creditLineId ?? null,
    });
    if (o.creditLineId) {
      await tx.insert(transaction).values({
        id: newId(),
        userId: o.userId,
        kind: "expense",
        amountCents: o.amountCents,
        date: today(),
        creditLineId: o.creditLineId,
        categoryId: o.categoryId ?? null,
        note: `A nombre de otra persona: ${o.concept}`,
      });
    } else {
      await moveBalance(tx, o.accountId, -o.amountCents);
    }
  });
  return id;
}

/** Saldo pendiente de cada préstamo activo. */
export async function receivableBalances(userId: string) {
  const [rows, pays] = await Promise.all([
    db.select().from(receivable).where(eq(receivable.userId, userId)),
    db.select().from(receivablePayment).where(eq(receivablePayment.userId, userId)),
  ]);
  return rows.map((r) => {
    const paid = pays.filter((p) => p.receivableId === r.id).reduce((s, p) => s + p.amountCents, 0);
    return { ...r, paidCents: paid, pendingCents: Math.max(0, r.amountCents - paid), payments: pays.filter((p) => p.receivableId === r.id) };
  });
}

/**
 * Abono de una persona. Si no se indica el préstamo, se aplica a los más antiguos primero.
 * El dinero entra a la cuenta elegida; los préstamos que llegan a $0 se marcan liquidados.
 */
export async function recordRepayment(o: { userId: string; contactId: string; amountCents: number; accountId: string | null; receivableId?: string }) {
  const balances = (await receivableBalances(o.userId))
    .filter((r) => r.contactId === o.contactId && r.status === "active" && (!o.receivableId || r.id === o.receivableId))
    .sort((a, b) => a.date.localeCompare(b.date) || a.createdAt.getTime() - b.createdAt.getTime());
  let left = o.amountCents;
  await db.transaction(async (tx) => {
    for (const r of balances) {
      if (left <= 0) break;
      const apply = Math.min(left, r.pendingCents);
      if (apply <= 0) continue;
      await tx.insert(receivablePayment).values({
        id: newId(),
        userId: o.userId,
        receivableId: r.id,
        amountCents: apply,
        date: today(),
        accountId: o.accountId,
      });
      if (apply >= r.pendingCents) await tx.update(receivable).set({ status: "settled" }).where(eq(receivable.id, r.id));
      left -= apply;
    }
    await moveBalance(tx, o.accountId, o.amountCents - Math.max(0, left));
  });
  return { applied: o.amountCents - Math.max(0, left), extra: Math.max(0, left) };
}

/** CA-28: lo que ya no se cobrará pasa a gasto en "Préstamos a terceros". */
export async function forgiveReceivable(userId: string, receivableId: string, categoryId: string | null) {
  const r = (await receivableBalances(userId)).find((x) => x.id === receivableId);
  if (!r || r.status !== "active") return;
  await db.transaction(async (tx) => {
    await tx.update(receivable).set({ status: "forgiven" }).where(eq(receivable.id, r.id));
    if (r.pendingCents > 0) {
      await tx.insert(transaction).values({
        id: newId(),
        userId,
        kind: "expense",
        amountCents: r.pendingCents,
        date: today(),
        categoryId,
        note: `Incobrable: ${r.concept}`,
      });
    }
  });
}
