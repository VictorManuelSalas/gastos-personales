import { today } from "@gp/core";
import { cycle, db, moneyAccount, transaction, type CreditLine } from "@gp/db";
import { eq, sql } from "drizzle-orm";
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
