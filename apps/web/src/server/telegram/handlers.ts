import {
  DEFAULT_PAYDAYS,
  formatMXN,
  normalizeText,
  originalWords,
  parseMessage,
  parsePaydayRule,
  parseSimulation,
  addCooldown,
  quincenaFor,
  today,
} from "@gp/core";
import { category, contact, creditLine, cycle, db, goal, moneyAccount, telegramLinkToken, transaction, user, wishlistItem, type Category } from "@gp/db";
import { and, desc, eq, gt, gte, isNull, lte } from "drizzle-orm";
import { fmtDay, fmtShort } from "@/lib/dates";
import { newId } from "@/server/actions/util";
import { learnCategory, suggestCategory } from "@/server/finance/categorize";
import { loadGoals } from "@/server/finance/goals";
import {
  createLoan,
  deleteTransaction,
  findOrCreateContact,
  markCyclePaid,
  moveGoal,
  receivableBalances,
  recordRepayment,
  recordTransaction,
} from "@/server/finance/mutations";
import { isPayable, loadFinance } from "@/server/finance/overview";
import { simulatePurchase } from "@/server/finance/simulate";
import { activeTravel, applyTags, extractHashtags, spentWithTag, startTravel, stopTravel } from "@/server/finance/tags";
import { FAILURE_TEXT, readReceipt, transcribe } from "@/server/ai/receipt";
import { answerCallback, downloadFile, editMessageText, esc, sendMessage } from "./client";

type Update = {
  message?: {
    chat: { id: number };
    text?: string;
    caption?: string;
    from?: { first_name?: string };
    photo?: { file_id: string; width: number; height: number }[];
    document?: { file_id: string; mime_type?: string };
    voice?: { file_id: string; mime_type?: string; duration?: number };
    audio?: { file_id: string; mime_type?: string; duration?: number };
  };
  callback_query?: { id: string; data?: string; message?: { chat: { id: number }; message_id: number; text?: string } };
};

const HELP =
  "Escríbeme como hablas:\n" +
  "• <b>café 65 nu</b> — gasto con tarjeta\n" +
  "• <b>tacos 180</b> — gasto con tu cuenta principal\n" +
  "• <b>+1500 horas extra</b> — ingreso\n" +
  "• <b>aparta 500 japón</b> — aporte a una meta\n" +
  "• <b>presté 2000 a liz</b> / <b>liz abonó 500</b> — Me deben\n" +
  "• <b>estado bbva 4568.71</b> — monto del estado de cuenta\n\n" +
  "• <b>/simula celular 9000 12 msi nu</b> — ¿me alcanza?\n" +
  "• <b>/viaje cancún</b> — todo lo que registres lleva #cancun (/viaje fin para terminar)\n" +
  "• Agrega <b>#etiquetas</b> a cualquier gasto\n" +
  "• <b>/deseo audífonos 2500</b> — espera 72 h antes de comprar\n\n" +
  "/quincena · /pagos · /metas · /medeben · /deshacer";

async function userByChat(chatId: number) {
  const [u] = await db.select().from(user).where(eq(user.telegramChatId, String(chatId)));
  return u ?? null;
}

const capitalize = (s: string) => s.replace(/^\p{L}/u, (c) => c.toUpperCase());

/** Cuenta principal disponible (para gastos sin fuente, ingresos y abonos). */
async function mainAccount(userId: string) {
  const [a] = await db
    .select()
    .from(moneyAccount)
    .where(and(eq(moneyAccount.userId, userId), isNull(moneyAccount.archivedAt), eq(moneyAccount.inAvailable, true)))
    .orderBy(desc(moneyAccount.isDefault))
    .limit(1);
  return a ?? null;
}

async function userCategories(userId: string, kind: "expense" | "income") {
  return db
    .select()
    .from(category)
    .where(and(eq(category.userId, userId), eq(category.kind, kind), isNull(category.archivedAt)))
    .orderBy(category.sortOrder, category.name);
}

/** Regla/aprendizaje primero; si no, una palabra de la descripción que empiece una palabra del nombre ("cafe" → "Café y antojos"). */
async function guessCategory(userId: string, description: string, kind: "expense" | "income"): Promise<Category | null> {
  if (!description) return null;
  const byRule = await suggestCategory(userId, description, kind);
  if (byRule) return byRule;
  const words = normalizeText(description).split(" ").filter((w) => w.length >= 3);
  const cats = await userCategories(userId, kind);
  return cats.find((c) => normalizeText(c.name).split(" ").some((cw) => words.some((w) => cw.startsWith(w) || (w.startsWith(cw) && cw.length >= 4)))) ?? null;
}

/** Total de antojos (categorías hormiga) en la quincena actual. */
async function antTotal(userId: string, payDays: string) {
  const q = quincenaFor(parsePaydayRule(payDays) ?? DEFAULT_PAYDAYS, today());
  const rows = await db
    .select({ amount: transaction.amountCents })
    .from(transaction)
    .innerJoin(category, eq(transaction.categoryId, category.id))
    .where(and(eq(transaction.userId, userId), eq(transaction.kind, "expense"), eq(category.isAnt, true), gte(transaction.date, q.payday), lte(transaction.date, q.end)));
  return rows.reduce((s, r) => s + r.amount, 0);
}

const txnButtons = (id: string): [string, string][] => [
  ["Cambiar categoría", `cat:${id}`],
  ["Borrar", `del:${id}`],
];

export async function handleUpdate(update: Update): Promise<unknown> {
  if (update.callback_query) return handleCallback(update.callback_query);
  const msg = update.message;
  if (!msg) return;
  if (msg.photo?.length || msg.document?.mime_type?.startsWith("image/")) return handlePhoto(msg);
  if (msg.voice || msg.audio) return handleVoice(msg);
  if (!msg.text) return;
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
        `Disponible hoy ${formatMXN(q.startCents)} · por entrar ${formatMXN(q.inCents)} · por pagar ${formatMXN(q.outCents)}` +
        (lines ? `\n\nPendiente:\n${lines}` : ""),
    );
  }

  if (text === "/pagos") {
    const f = await loadFinance(u.id);
    const items = f.quincenas
      .flatMap((q) => q.items)
      .filter((i) => i.direction === "out" && i.status === "pending" && i.kind !== "goal")
      .slice(0, 8)
      .map((i) => `• ${fmtDay(i.date)} — ${esc(i.label)} <b>${formatMXN(i.amountCents)}</b>`);
    return sendMessage(chatId, items.length ? `Próximos pagos:\n${items.join("\n")}` : "No tienes pagos pendientes.");
  }

  if (text === "/metas") {
    const goals = await loadGoals(u.id, parsePaydayRule(u.payDays, u.paydayPolicy) ?? DEFAULT_PAYDAYS, today());
    if (!goals.length) return sendMessage(chatId, "Aún no tienes metas. Créalas en la app → Metas.");
    return sendMessage(
      chatId,
      goals
        .map((g) => `${g.emoji} ${esc(g.name)}: <b>${formatMXN(g.savedCents)}</b>${g.targetCents ? ` de ${formatMXN(g.targetCents)} (${g.progress}%)` : ""}`)
        .join("\n"),
    );
  }

  if (text === "/medeben") {
    const rows = (await receivableBalances(u.id)).filter((r) => r.status === "active");
    if (!rows.length) return sendMessage(chatId, "Nadie te debe nada. 🎉");
    const people = await db.select().from(contact).where(eq(contact.userId, u.id));
    const totals = new Map<string, number>();
    for (const r of rows) totals.set(r.contactId, (totals.get(r.contactId) ?? 0) + r.pendingCents);
    const list = [...totals.entries()].map(([id, c]) => `• ${esc(people.find((p) => p.id === id)?.name ?? "?")}: <b>${formatMXN(c)}</b>`);
    return sendMessage(chatId, `Te deben ${formatMXN([...totals.values()].reduce((a, b) => a + b, 0))}:\n${list.join("\n")}`);
  }

  if (text === "/deshacer") {
    const [last] = await db
      .select()
      .from(transaction)
      .where(and(eq(transaction.userId, u.id), eq(transaction.origin, "telegram"), gt(transaction.createdAt, new Date(Date.now() - 15 * 60_000))))
      .orderBy(desc(transaction.createdAt))
      .limit(1);
    if (!last) return sendMessage(chatId, "No hay nada reciente que deshacer (solo los últimos 15 minutos).");
    await deleteTransaction(u.id, last.id);
    return sendMessage(chatId, `🗑 Borré ${esc(last.merchant ?? "el movimiento")} de ${formatMXN(last.amountCents)}.`);
  }

  if (text.startsWith("/simula")) {
    const cards = await db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card")));
    const p = parseSimulation(text, cards);
    if (!p.priceCents) return sendMessage(chatId, "Escríbelo así: <b>/simula celular 9000 12 msi nu</b>");
    const lineId = p.lineId ?? cards[0]?.id;
    if (!lineId) return sendMessage(chatId, "Primero registra una tarjeta en la app.");
    const sim = await simulatePurchase(u.id, { lineId, product: p.product, priceCents: p.priceCents, months: p.months });
    if (!sim) return sendMessage(chatId, "No pude simularlo con esa tarjeta.");
    const icon = sim.verdict.level === "good" ? "🟢" : sim.verdict.level === "warn" ? "🟡" : "🔴";
    return sendMessage(
      chatId,
      `${icon} ${esc(sim.verdict.text)}\n\n` +
        `${esc(capitalize(sim.product))} en ${esc(sim.line.name)}: <b>${formatMXN(sim.monthlyCents)}</b>${sim.months > 1 ? ` × ${sim.months} meses` : ""}\n` +
        (sim.msiPctBefore != null ? `MSI: ${sim.msiPctBefore}% → ${sim.msiPctAfter}% de tu ingreso\n` : "") +
        `Quincena más apretada: ${formatMXN(sim.minBefore, { round: true })} → <b>${formatMXN(sim.minAfter, { round: true })}</b>`,
    );
  }

  if (text.startsWith("/viaje")) {
    const arg = text.replace(/^\/viaje\s*/, "").trim();
    if (!arg) {
      const t = await activeTravel(u.id);
      return sendMessage(
        chatId,
        t
          ? `✈️ Modo viaje activo: <b>#${esc(t.name)}</b>. Llevas ${formatMXN(await spentWithTag(u.id, t.tagId))}. Para terminar: /viaje fin`
          : "Activa el modo viaje así: <b>/viaje cancún</b>. Todo lo que registres llevará esa etiqueta.",
      );
    }
    if (["fin", "terminar", "off", "stop"].includes(normalizeText(arg))) {
      const r = await stopTravel(u.id);
      return sendMessage(chatId, r ? `🏁 Terminó el modo viaje #${esc(r.name)}. Gastaste <b>${formatMXN(r.spentCents)}</b>.` : "No hay un viaje activo.");
    }
    const r = await startTravel(u.id, arg);
    if (!r) return sendMessage(chatId, "Ese nombre no sirve como etiqueta. Prueba con letras y números.");
    return sendMessage(
      chatId,
      `✈️ Modo viaje activo: <b>#${esc(r.tag.name)}</b>.` +
        (r.goal ? ` Lo que gastes se descuenta de tu meta ${esc(r.goal.name)}.` : "") +
        "\nTodo lo que registres aquí llevará esa etiqueta. Para terminar: /viaje fin",
    );
  }

  if (text.startsWith("/deseo")) {
    const cards = await db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card")));
    const p = parseSimulation(text.replace(/^\/deseo/i, "/simula"), cards);
    if (!p.priceCents) return sendMessage(chatId, "Escríbelo así: <b>/deseo audífonos 2500</b> (o <b>/deseo laptop 12000 12 msi nu</b>)");
    await db.insert(wishlistItem).values({
      id: newId(),
      userId: u.id,
      product: capitalize(originalWords(text, p.product)),
      priceCents: p.priceCents,
      months: p.months,
      creditLineId: p.lineId,
      availableAt: addCooldown(),
    });
    return sendMessage(chatId, `⏳ Guardé ${esc(capitalize(originalWords(text, p.product)))} (${formatMXN(p.priceCents)}). En 72 horas te pregunto si todavía lo quieres.`);
  }

  if (text === "/ayuda" || text === "/help") return sendMessage(chatId, HELP);

  const [lines, accounts, goals] = await Promise.all([
    db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, u.id), isNull(moneyAccount.archivedAt))),
    db.select({ id: goal.id, name: goal.name }).from(goal).where(and(eq(goal.userId, u.id), isNull(goal.archivedAt))),
  ]);
  const hashed = extractHashtags(text);
  const travel = await activeTravel(u.id);
  const tagNames = [...hashed.tags, ...(travel && !hashed.tags.includes(travel.name) ? [travel.name] : [])];
  const parsed = parseMessage(hashed.text, { lines, accounts, goals });

  switch (parsed.type) {
    case "expense": {
      const main = await mainAccount(u.id);
      const source =
        parsed.source ?? (main ? { kind: "account" as const, id: main.id } : lines[0] ? { kind: "line" as const, id: lines[0].id } : null);
      if (!source) return sendMessage(chatId, "Primero agrega una cuenta o tarjeta en la app para saber de dónde sale el dinero.");
      const cat = await guessCategory(u.id, parsed.description, "expense");
      const id = await recordTransaction({
        userId: u.id,
        kind: "expense",
        amountCents: parsed.amountCents,
        categoryId: cat?.id ?? null,
        accountId: source.kind === "account" ? source.id : null,
        creditLineId: source.kind === "line" ? source.id : null,
        merchant: parsed.description ? capitalize(originalWords(hashed.text, parsed.description)) : null,
        origin: "telegram",
      });
      const applied = await applyTags(u.id, id, tagNames);
      const sourceName = source.kind === "line" ? lines.find((l) => l.id === source.id)?.name : accounts.find((a) => a.id === source.id)?.name;
      const ant = cat?.isAnt ? `\nAntojos esta quincena: ${formatMXN(await antTotal(u.id, u.payDays))}` : "";
      const tagsLine = applied.length ? ` · ${applied.map((t) => `#${esc(t.name)}`).join(" ")}` : "";
      return sendMessage(
        chatId,
        `✓ <b>${formatMXN(parsed.amountCents)}</b> · ${cat ? `${cat.emoji} ${esc(cat.name)}` : "Sin categoría"} · ${esc(sourceName ?? "")}${tagsLine}${ant}`,
        txnButtons(id),
      );
    }

    case "income": {
      const account = accounts.find((a) => a.id === parsed.accountId) ?? (await mainAccount(u.id));
      if (!account) return sendMessage(chatId, "Agrega primero una cuenta en la app para saber dónde entra el dinero.");
      const cat = await guessCategory(u.id, parsed.description, "income");
      const id = await recordTransaction({
        userId: u.id,
        kind: "income",
        amountCents: parsed.amountCents,
        categoryId: cat?.id ?? null,
        accountId: account.id,
        merchant: parsed.description ? capitalize(originalWords(hashed.text, parsed.description)) : "Ingreso",
        origin: "telegram",
      });
      return sendMessage(chatId, `↑ Ingreso de <b>${formatMXN(parsed.amountCents)}</b>${cat ? ` · ${cat.emoji} ${esc(cat.name)}` : ""} · ${esc(account.name)}`, txnButtons(id));
    }

    case "contribution": {
      if (!parsed.goalId) {
        return sendMessage(chatId, goals.length ? `No encontré la meta "${esc(parsed.goalQuery)}". Tus metas: ${goals.map((g) => esc(g.name)).join(", ")}.` : "Aún no tienes metas. Créalas en la app → Metas.");
      }
      const main = await mainAccount(u.id);
      await moveGoal({ userId: u.id, goalId: parsed.goalId, amountCents: parsed.amountCents, fromAccountId: main?.id ?? null, origin: "telegram" });
        const g = (await loadGoals(u.id, parsePaydayRule(u.payDays, u.paydayPolicy) ?? DEFAULT_PAYDAYS, today())).find((x) => x.id === parsed.goalId)!;
      return sendMessage(
        chatId,
        `${g.emoji} Apartaste <b>${formatMXN(parsed.amountCents)}</b> para ${esc(g.name)}. Llevas ${formatMXN(g.savedCents)}${g.targetCents ? ` de ${formatMXN(g.targetCents)} (${g.progress}%)` : ""}.`,
      );
    }

    case "lend": {
      const main = await mainAccount(u.id);
      const person = await findOrCreateContact(u.id, parsed.contactName);
      const cardId = parsed.source?.kind === "line" ? parsed.source.id : null;
      const accountId = parsed.source?.kind === "account" ? parsed.source.id : cardId ? null : (main?.id ?? null);
      await createLoan({ userId: u.id, contactId: person!.id, kind: cardId ? "purchase" : "cash", concept: capitalize(originalWords(hashed.text, parsed.description)), amountCents: parsed.amountCents, accountId, creditLineId: cardId });
      const pending = (await receivableBalances(u.id)).filter((r) => r.contactId === person!.id && r.status === "active").reduce((s, r) => s + r.pendingCents, 0);
      return sendMessage(chatId, `🤝 Le prestaste <b>${formatMXN(parsed.amountCents)}</b> a ${esc(person!.name)}. En total te debe ${formatMXN(pending)}.`);
    }

    case "repayment": {
      const person = await findOrCreateContact(u.id, parsed.contactName, false);
      if (!person) return sendMessage(chatId, `No tengo registrado a "${esc(parsed.contactName)}" en Me deben.`);
      const main = await mainAccount(u.id);
      const r = await recordRepayment({ userId: u.id, contactId: person.id, amountCents: parsed.amountCents, accountId: main?.id ?? null });
      const pending = (await receivableBalances(u.id)).filter((x) => x.contactId === person.id && x.status === "active").reduce((s, x) => s + x.pendingCents, 0);
      return sendMessage(
        chatId,
        `💵 ${esc(person.name)} abonó <b>${formatMXN(r.applied)}</b>${main ? ` (entró a ${esc(main.name)})` : ""}. ${pending ? `Aún te debe ${formatMXN(pending)}.` : "Ya no te debe nada. 🎉"}` +
          (r.extra ? `\nSobraron ${formatMXN(r.extra)} que no se registraron.` : ""),
      );
    }

    case "statement": {
      const all = await db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt)));
      const line = all.find((l) => l.id === parsed.lineId);
      if (!line) return sendMessage(chatId, `No encontré la tarjeta "${esc(parsed.lineQuery)}".`);
      const f = await loadFinance(u.id);
      const cv = f.cycleViews.filter((c) => c.lineId === line.id && c.cut <= today() && c.status !== "paid").sort((a, b) => b.cut.localeCompare(a.cut))[0];
      if (!cv) return sendMessage(chatId, `${esc(line.name)} no tiene un corte pendiente.`);
      await db
        .insert(cycle)
        .values({ id: newId(), userId: u.id, creditLineId: line.id, cutDate: cv.cut, statementCents: parsed.amountCents })
        .onConflictDoUpdate({ target: [cycle.creditLineId, cycle.cutDate], set: { statementCents: parsed.amountCents, updatedAt: new Date() } });
      return sendMessage(chatId, `✓ ${esc(line.name)}: estado de cuenta de <b>${formatMXN(parsed.amountCents)}</b>. Vence el ${fmtDay(cv.due)} y sale de tu quincena del ${fmtShort(cv.payday)}.`);
    }

    case "missing_amount":
      return sendMessage(chatId, `¿Cuánto fue? Escríbelo con el monto, por ejemplo: <b>${esc(parsed.description || "café")} 65</b>`);

    default:
      return sendMessage(chatId, HELP);
  }
}

async function handleCallback(cb: NonNullable<Update["callback_query"]>) {
  const chatId = cb.message?.chat.id;
  const [kind, a, b] = (cb.data ?? "").split(":");
  if (!chatId || !kind || !a) return answerCallback(cb.id);
  const u = await userByChat(chatId);
  if (!u) return answerCallback(cb.id, "Este chat ya no está conectado.");

  // Borrar un movimiento recién registrado.
  if (kind === "del") {
    const t = await deleteTransaction(u.id, a);
    await answerCallback(cb.id, t ? "Borrado" : "Ya no existe");
    if (t && cb.message) await editMessageText(chatId, cb.message.message_id, `🗑 Borrado: ${esc(t.merchant ?? "movimiento")} de ${formatMXN(t.amountCents)}.`);
    return;
  }

  // Mostrar categorías para elegir.
  if (kind === "cat") {
    const [t] = await db.select().from(transaction).where(and(eq(transaction.id, a), eq(transaction.userId, u.id)));
    if (!t || (t.kind !== "expense" && t.kind !== "income")) return answerCallback(cb.id, "Ya no existe");
    const cats = await userCategories(u.id, t.kind);
    const rows: [string, string][][] = [];
    cats.slice(0, 20).forEach((c, i) => {
      if (i % 2 === 0) rows.push([]);
      rows[rows.length - 1]!.push([`${c.emoji} ${c.name}`, `sc:${t.id}:${i}`]);
    });
    await answerCallback(cb.id);
    if (cb.message) await editMessageText(chatId, cb.message.message_id, `Elige la categoría de ${esc(t.merchant ?? "este movimiento")} (${formatMXN(t.amountCents)}):`, rows);
    return;
  }

  // Asignar categoría elegida (y aprenderla para ese comercio).
  if (kind === "sc" && b != null) {
    const [t] = await db.select().from(transaction).where(and(eq(transaction.id, a), eq(transaction.userId, u.id)));
    if (!t || (t.kind !== "expense" && t.kind !== "income")) return answerCallback(cb.id, "Ya no existe");
    const cat = (await userCategories(u.id, t.kind))[Number(b)];
    if (!cat) return answerCallback(cb.id, "Categoría no encontrada");
    await db.update(transaction).set({ categoryId: cat.id }).where(eq(transaction.id, t.id));
    if (t.merchant) await learnCategory(u.id, t.merchant, cat.id);
    await answerCallback(cb.id, "Listo");
    if (cb.message) {
      await editMessageText(chatId, cb.message.message_id, `✓ <b>${formatMXN(t.amountCents)}</b> · ${cat.emoji} ${esc(cat.name)} · ${esc(t.merchant ?? "")}`, txnButtons(t.id));
    }
    return;
  }

  // Decisión sobre un deseo después de 72 h.
  if (kind === "wish" && b) {
    const status = b === "bought" ? "bought" : "dropped";
    const [w] = await db
      .update(wishlistItem)
      .set({ status, decidedAt: new Date() })
      .where(and(eq(wishlistItem.id, a), eq(wishlistItem.userId, u.id), eq(wishlistItem.status, "waiting")))
      .returning();
    await answerCallback(cb.id, w ? "Listo" : "Ya estaba decidido");
    if (w && cb.message) {
      await editMessageText(
        chatId,
        cb.message.message_id,
        status === "dropped" ? `👏 Dejaste pasar ${esc(w.product)}: ${formatMXN(w.priceCents)} siguen en tu bolsa.` : `🛍️ Anotado: compraste ${esc(w.product)}.`,
      );
    }
    return;
  }

  // "Ya pagué" de un aviso.
  if (kind === "paid" && b) {
    const [line] = await db.select().from(creditLine).where(and(eq(creditLine.id, a), eq(creditLine.userId, u.id)));
    if (!line) return answerCallback(cb.id, "No encontré esa tarjeta.");
    const f = await loadFinance(u.id);
    const cv = f.cycleViews.find((c) => c.lineId === a && c.cut === b);
    if (!cv || cv.status === "paid") return answerCallback(cb.id, "Ya estaba marcado como pagado.");
    if (!isPayable(cv, line.kind)) return answerCallback(cb.id, "Ese ciclo no tiene pago pendiente.");
    const main = await mainAccount(u.id);
    await markCyclePaid({ userId: u.id, line, cut: b, amountCents: cv.amountCents, accountId: main?.id ?? null });
    await answerCallback(cb.id, "Marcado como pagado");
    if (cb.message) {
      await editMessageText(chatId, cb.message.message_id, `✅ ${esc(line.name)} pagado: <b>${formatMXN(cv.amountCents)}</b>${main ? ` desde ${esc(main.name)}` : ""}.`);
    }
    return;
  }

  return answerCallback(cb.id);
}


/**
 * Foto de un ticket: la IA del usuario (Gemini, OpenAI o Claude) lee total, comercio y fecha, y se registra el gasto.
 * El pie de foto puede indicar la tarjeta o cuenta ("nu", "efectivo") y #etiquetas.
 */
async function handlePhoto(msg: NonNullable<Update["message"]>) {
  const chatId = msg.chat.id;
  const u = await userByChat(chatId);
  if (!u) return sendMessage(chatId, "No reconozco este chat. Conéctalo desde Quincena → Más → Ajustes → Conectar Telegram.");

  const fileId = msg.photo?.length ? msg.photo[msg.photo.length - 1]!.file_id : msg.document!.file_id;
  const file = await downloadFile(fileId);
  if (!file) return sendMessage(chatId, "No pude descargar la foto. Intenta de nuevo.");
  const ext = file.path.split(".").pop()?.toLowerCase();
  const mediaType = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";

  await sendMessage(chatId, "🧾 Leyendo tu ticket…");
  const r = await readReceipt(u.id, file.data.toString("base64"), mediaType);
  if (!r.ok) return sendMessage(chatId, FAILURE_TEXT[r.reason]);

  const [lines, accounts] = await Promise.all([
    db.select().from(creditLine).where(and(eq(creditLine.userId, u.id), isNull(creditLine.archivedAt), eq(creditLine.kind, "card"))),
    db.select().from(moneyAccount).where(and(eq(moneyAccount.userId, u.id), isNull(moneyAccount.archivedAt))),
  ]);
  const caption = extractHashtags(msg.caption ?? "");
  const fromCaption = caption.text ? parseMessage(`x 1 ${caption.text}`, { lines, accounts, goals: [] }) : null;
  const main = await mainAccount(u.id);
  const source =
    fromCaption?.type === "expense" && fromCaption.source
      ? fromCaption.source
      : main
        ? { kind: "account" as const, id: main.id }
        : lines[0]
          ? { kind: "line" as const, id: lines[0].id }
          : null;
  if (!source) return sendMessage(chatId, "Primero agrega una cuenta o tarjeta en la app.");

  const t = today();
  const recent = r.data.date && r.data.date <= t && r.data.date >= new Date(Date.now() - 60 * 86_400_000).toISOString().slice(0, 10);
  const cat = r.data.merchant ? await guessCategory(u.id, r.data.merchant, "expense") : null;
  const id = await recordTransaction({
    userId: u.id,
    kind: "expense",
    amountCents: r.data.totalCents,
    date: recent ? r.data.date! : t,
    categoryId: cat?.id ?? null,
    accountId: source.kind === "account" ? source.id : null,
    creditLineId: source.kind === "line" ? source.id : null,
    merchant: r.data.merchant,
    note: "Leído de la foto del ticket",
    origin: "telegram",
  });
  const travel = await activeTravel(u.id);
  const applied = await applyTags(u.id, id, [...caption.tags, ...(travel ? [travel.name] : [])]);
  const sourceName = source.kind === "line" ? lines.find((l) => l.id === source.id)?.name : accounts.find((a) => a.id === source.id)?.name;
  return sendMessage(
    chatId,
    `✓ <b>${formatMXN(r.data.totalCents)}</b> · ${esc(r.data.merchant ?? "Ticket")} · ${cat ? `${cat.emoji} ${esc(cat.name)}` : "Sin categoría"} · ${esc(sourceName ?? "")}` +
      (applied.length ? ` · ${applied.map((x) => `#${esc(x.name)}`).join(" ")}` : "") +
      (r.data.confidence !== "high" ? "\n⚠️ El total no se leía del todo claro; revísalo." : ""),
    txnButtons(id),
  );
}

/**
 * Nota de voz: la IA del usuario la transcribe y el texto se procesa igual que si
 * lo hubiera escrito ("tacos 180 nu"). Solo Gemini y OpenAI entienden audio.
 */
async function handleVoice(msg: NonNullable<Update["message"]>): Promise<unknown> {
  const chatId = msg.chat.id;
  const u = await userByChat(chatId);
  if (!u) return sendMessage(chatId, "No reconozco este chat. Conéctalo desde Quincena → Más → Ajustes → Conectar Telegram.");
  const media = msg.voice ?? msg.audio!;
  if ((media.duration ?? 0) > 60) return sendMessage(chatId, "La nota es muy larga. Mándame algo corto, por ejemplo: «tacos ciento ochenta con nu».");

  const file = await downloadFile(media.file_id);
  if (!file) return sendMessage(chatId, "No pude descargar el audio. Intenta de nuevo.");
  const mime = media.mime_type || (file.path.endsWith(".oga") || file.path.endsWith(".ogg") ? "audio/ogg" : "audio/mpeg");

  const r = await transcribe(u.id, file.data, mime);
  if (!r.ok) return sendMessage(chatId, FAILURE_TEXT[r.reason]);
  const text = r.text.replace(/[.¡!¿?]+$/g, "").trim();
  await sendMessage(chatId, `🎙️ Entendí: «${esc(text)}»`);
  return handleUpdate({ message: { ...msg, voice: undefined, audio: undefined, text } } as Update);
}
