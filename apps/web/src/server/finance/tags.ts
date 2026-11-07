import { normalizeText } from "@gp/core";
import { db, goal, tag, transaction, transactionTag, travelMode } from "@gp/db";
import { and, eq, inArray, sum } from "drizzle-orm";
import { newId } from "@/server/actions/util";
import { moveGoal } from "./mutations";

/** "#Viaje Cancún" → "viaje-cancun" */
export const slugTag = (s: string) =>
  normalizeText(s.replace(/^#/, ""))
    .replace(/[^a-z0-9ñ ]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);

/** Separa "#etiquetas" de un texto: ("tacos 180 #viaje", ...) → { text: "tacos 180", tags: ["viaje"] }. */
export function extractHashtags(text: string) {
  const tags = [...text.matchAll(/#([\p{L}\p{N}_-]+)/gu)].map((m) => slugTag(m[1]!)).filter(Boolean);
  return { text: text.replace(/#[\p{L}\p{N}_-]+/gu, " ").replace(/\s+/g, " ").trim(), tags: [...new Set(tags)] };
}

export async function upsertTag(userId: string, name: string, goalId?: string | null) {
  const slug = slugTag(name);
  if (!slug) return null;
  const [existing] = await db.select().from(tag).where(and(eq(tag.userId, userId), eq(tag.name, slug)));
  if (existing) {
    if (goalId && existing.goalId !== goalId) await db.update(tag).set({ goalId }).where(eq(tag.id, existing.id));
    return { ...existing, goalId: goalId ?? existing.goalId };
  }
  const [t] = await db.insert(tag).values({ id: newId(), userId, name: slug, goalId: goalId ?? null }).onConflictDoNothing().returning();
  return t ?? (await db.select().from(tag).where(and(eq(tag.userId, userId), eq(tag.name, slug))))[0]!;
}

/**
 * Etiqueta un movimiento. Si la etiqueta está ligada a una meta (modo viaje),
 * el gasto se descuenta de lo apartado en esa meta (PRD 7.5, CA-16).
 */
export async function applyTags(userId: string, transactionId: string, names: string[]) {
  if (!names.length) return [];
  const [t] = await db.select().from(transaction).where(and(eq(transaction.id, transactionId), eq(transaction.userId, userId)));
  if (!t) return [];
  const applied = [];
  for (const n of names) {
    const tg = await upsertTag(userId, n);
    if (!tg) continue;
    await db.insert(transactionTag).values({ transactionId, tagId: tg.id }).onConflictDoNothing();
    applied.push(tg);
    if (tg.goalId && t.kind === "expense") {
      await moveGoal({ userId, goalId: tg.goalId, amountCents: -t.amountCents, note: `Gasto: ${t.merchant ?? "sin descripción"}` });
    }
  }
  return applied;
}

export async function activeTravel(userId: string) {
  const [row] = await db
    .select({ tagId: tag.id, name: tag.name, goalId: tag.goalId, startedAt: travelMode.startedAt })
    .from(travelMode)
    .innerJoin(tag, eq(travelMode.tagId, tag.id))
    .where(eq(travelMode.userId, userId));
  return row ?? null;
}

/** Activa el modo viaje: todo lo que registres por el bot llevará esta etiqueta. */
export async function startTravel(userId: string, name: string) {
  const goals = await db.select().from(goal).where(eq(goal.userId, userId));
  const q = normalizeText(name);
  const g = goals.find((x) => !x.archivedAt && (normalizeText(x.name).includes(q) || q.includes(normalizeText(x.name))));
  const tg = await upsertTag(userId, g ? g.name : name, g?.id ?? null);
  if (!tg) return null;
  await db
    .insert(travelMode)
    .values({ userId, tagId: tg.id })
    .onConflictDoUpdate({ target: travelMode.userId, set: { tagId: tg.id, startedAt: new Date() } });
  return { tag: tg, goal: g ?? null };
}

export async function stopTravel(userId: string) {
  const t = await activeTravel(userId);
  if (!t) return null;
  await db.delete(travelMode).where(eq(travelMode.userId, userId));
  return { ...t, spentCents: await spentWithTag(userId, t.tagId) };
}

export async function spentWithTag(userId: string, tagId: string) {
  const [row] = await db
    .select({ total: sum(transaction.amountCents) })
    .from(transactionTag)
    .innerJoin(transaction, eq(transactionTag.transactionId, transaction.id))
    .where(and(eq(transactionTag.tagId, tagId), eq(transaction.userId, userId), eq(transaction.kind, "expense")));
  return Number(row?.total ?? 0);
}

export async function tagsForTransactions(ids: string[]) {
  if (!ids.length) return new Map<string, string[]>();
  const rows = await db
    .select({ txn: transactionTag.transactionId, name: tag.name })
    .from(transactionTag)
    .innerJoin(tag, eq(transactionTag.tagId, tag.id))
    .where(inArray(transactionTag.transactionId, ids));
  const m = new Map<string, string[]>();
  for (const r of rows) m.set(r.txn, [...(m.get(r.txn) ?? []), r.name]);
  return m;
}

/** Etiqueta ligada a una meta (si existe). */
export async function upsertTagLookup(userId: string, goalId: string) {
  const [t] = await db.select().from(tag).where(and(eq(tag.userId, userId), eq(tag.goalId, goalId)));
  return t ?? null;
}
