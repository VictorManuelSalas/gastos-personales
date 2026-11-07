import { formatMXN, parseMoney, today } from "@gp/core";
import { creditLine, cycle, db, moneyAccount, telegramLinkToken, user } from "@gp/db";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { fmtDay, fmtShort } from "@/lib/dates";
import { newId } from "@/server/actions/util";
import { markCyclePaid } from "@/server/finance/mutations";
import { isPayable, loadFinance } from "@/server/finance/overview";
import { answerCallback, editMessageText, esc, sendMessage } from "./client";

type Update = {
  message?: { chat: { id: number }; text?: string; from?: { first_name?: string } };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
};

const HELP =
  "Por ahora te aviso de tus fechas límite y te digo cómo va tu quincena.\n\n" +
  "/quincena — lo que te queda esta quincena\n" +
  "/pagos — próximos pagos\n" +
  "<b>BBVA 4568.71</b> — guarda el monto del estado de cuenta\n\n" +
  "Pronto podrás registrar gastos escribiendo como hablas (<i>café 65 nu</i>).";

async function userByChat(chatId: number) {
  const [u] = await db.select().from(user).where(eq(user.telegramChatId, String(chatId)));
  return u ?? null;
}

export async function handleUpdate(update: Update) {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg?.text) return;
  const chatId = msg.chat.id;
  const text = msg.text.trim();

  // Vincular: /start <token>
  if (text.startsWith("/start")) {
    const token = text.split(/\s+/)[1];
    if (!token) {
      const u = await userByChat(chatId);
      return sendMessage(chatId, u ? `Hola de nuevo, ${esc(u.name.split(" ")[0]!)}.\n\n${HELP}` : "Para conectar tu cuenta, abre Quincena → Más → Ajustes → Conectar Telegram.");
    }
    const [row] = await db
      .select()
      .from(telegramLinkToken)
      .where(and(eq(telegramLinkToken.token, token), gt(telegramLinkToken.expiresAt, new Date())));
    if (!row) return sendMessage(chatId, "Este enlace ya venció. Genera uno nuevo desde Ajustes en la app.");
    // Un chat solo puede estar ligado a una cuenta.
    await db.update(user).set({ telegramChatId: null, telegramLinkedAt: null }).where(eq(user.telegramChatId, String(chatId)));
    const [u] = await db
      .update(user)
      .set({ telegramChatId: String(chatId), telegramLinkedAt: new Date() })
      .where(eq(user.id, row.userId))
      .returning();
    await db.delete(telegramLinkToken).where(eq(telegramLinkToken.userId, row.userId));
    return sendMessage(chatId, `✅ Listo, ${esc(u!.name.split(" ")[0]!)}. Te avisaré antes de cada fecha límite.\n\n${HELP}`);
  }

  const u = await userByChat(chatId);
  if (!u) return sendMessage(chatId, "No reconozco este chat. Conéctalo desde Quincena → Más → Ajustes → Conectar Telegram.");

  if (text === "/quincena") {
    const f = await loadFinance(u.id);
    const q = f.quincenas[0]!;
    const pending = q.items.filter((i) => i.status === "pending" && i.direction === "out");
    const lines = pending.map((i) => `• ${esc(i.label)} ${formatMXN(i.amountCents)} — ${fmtShort(i.date)}`).join("\n");
    return sendMessage(
      chatId,
      `Quincena del ${fmtShort(q.payday)} al ${fmtShort(q.end)}\n\nTe quedan <b>${formatMXN(q.endCents)}</b>\n` +
        `Saldo hoy ${formatMXN(q.startCents)} · por entrar ${formatMXN(q.inCents)} · por pagar ${formatMXN(q.outCents)}` +
        (lines ? `\n\nPendiente:\n${lines}` : ""),
    );
  }

  if (text === "/pagos") {
    const f = await loadFinance(u.id);
    const items = f.quincenas
      .flatMap((q) => q.items)
      .filter((i) => i.direction === "out" && i.status === "pending")
      .slice(0, 8)
      .map((i) => `• ${fmtDay(i.date)} — ${esc(i.label)} <b>${formatMXN(i.amountCents)}</b>`);
    return sendMessage(chatId, items.length ? `Próximos pagos:\n${items.join("\n")}` : "No tienes pagos pendientes.");
  }

  if (text === "/ayuda" || text === "/help") return sendMessage(chatId, HELP);

  // "BBVA 4568.71" → monto del estado de cuenta del último corte de esa tarjeta.
  const m = text.match(/^(.+?)\s+\$?([\d,]+(?:\.\d{1,2})?)$/);
  if (m) {
    const amount = parseMoney(m[2]!);
    const name = m[1]!.toLowerCase();
    const lines = await db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt)));
    const line = lines.find((l) => l.name.toLowerCase() === name) ?? lines.find((l) => l.name.toLowerCase().startsWith(name));
    if (line && amount != null) {
      const f = await loadFinance(u.id);
      const cv = f.cycleViews
        .filter((c) => c.lineId === line.id && c.cut <= today() && c.status !== "paid")
        .sort((a, b) => b.cut.localeCompare(a.cut))[0];
      if (!cv) return sendMessage(chatId, `${esc(line.name)} no tiene un corte pendiente.`);
      await db
        .insert(cycle)
        .values({ id: newId(), userId: u.id, creditLineId: line.id, cutDate: cv.cut, statementCents: amount })
        .onConflictDoUpdate({ target: [cycle.creditLineId, cycle.cutDate], set: { statementCents: amount, updatedAt: new Date() } });
      return sendMessage(
        chatId,
        `✓ ${esc(line.name)}: estado de cuenta de <b>${formatMXN(amount)}</b>. Vence el ${fmtDay(cv.due)} y sale de tu quincena del ${fmtShort(cv.payday)}.`,
      );
    }
  }

  return sendMessage(chatId, HELP);
}

/** Botón "Ya pagué" de un aviso. */
async function handleCallback(cb: NonNullable<Update["callback_query"]>) {
  const chatId = cb.message?.chat.id;
  const [kind, lineId, cut] = (cb.data ?? "").split(":");
  if (!chatId || kind !== "paid" || !lineId || !cut) return answerCallback(cb.id);

  const u = await userByChat(chatId);
  if (!u) return answerCallback(cb.id, "Este chat ya no está conectado.");
  const [line] = await db.select().from(creditLine).where(and(eq(creditLine.id, lineId), eq(creditLine.userId, u.id)));
  if (!line) return answerCallback(cb.id, "No encontré esa tarjeta.");

  const f = await loadFinance(u.id);
  const cv = f.cycleViews.find((c) => c.lineId === lineId && c.cut === cut);
  if (!cv || cv.status === "paid") return answerCallback(cb.id, "Ya estaba marcado como pagado.");
  if (!isPayable(cv, line.kind)) return answerCallback(cb.id, "Ese ciclo no tiene pago pendiente.");

  const [account] = await db
    .select({ id: moneyAccount.id, name: moneyAccount.name })
    .from(moneyAccount)
    .where(and(eq(moneyAccount.userId, u.id), isNull(moneyAccount.archivedAt)))
    .orderBy(desc(moneyAccount.isDefault))
    .limit(1);

  await markCyclePaid({ userId: u.id, line, cut, amountCents: cv.amountCents, accountId: account?.id ?? null });
  await answerCallback(cb.id, "Marcado como pagado");
  if (cb.message) {
    await editMessageText(
      chatId,
      cb.message.message_id,
      `✅ ${esc(line.name)} pagado: <b>${formatMXN(cv.amountCents)}</b>${account ? ` desde ${esc(account.name)}` : ""}.`,
    );
  }
}
