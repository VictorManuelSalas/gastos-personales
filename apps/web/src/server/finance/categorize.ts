import { category, categoryRule, db } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import { newId } from "@/server/actions/util";

/** "Starbucks Coyoacán" → "starbucks coyoacan" */
export const normalizeMerchant = (s: string) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9ñ ]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();

/**
 * RN-19: busca la categoría para un comercio. Gana la regla manual sobre la aprendida,
 * y entre iguales la de texto más largo (más específica).
 */
export async function suggestCategory(userId: string, merchant: string, kind: "expense" | "income") {
  const m = normalizeMerchant(merchant);
  if (!m) return null;
  const rules = await db
    .select({ pattern: categoryRule.pattern, origin: categoryRule.origin, cat: category })
    .from(categoryRule)
    .innerJoin(category, eq(categoryRule.categoryId, category.id))
    .where(and(eq(categoryRule.userId, userId), eq(category.kind, kind), isNull(category.archivedAt)));
  const hit = rules
    .filter((r) => m.includes(r.pattern))
    .sort((a, b) => Number(b.origin === "manual") - Number(a.origin === "manual") || b.pattern.length - a.pattern.length)[0];
  return hit?.cat ?? null;
}

/** Recuerda la categoría elegida para el comercio (sin pisar reglas manuales). */
export async function learnCategory(userId: string, merchant: string, categoryId: string) {
  const pattern = normalizeMerchant(merchant);
  if (pattern.length < 2) return;
  const [existing] = await db
    .select()
    .from(categoryRule)
    .where(and(eq(categoryRule.userId, userId), eq(categoryRule.pattern, pattern)));
  if (existing?.origin === "manual") return;
  if (existing) {
    if (existing.categoryId !== categoryId) await db.update(categoryRule).set({ categoryId }).where(eq(categoryRule.id, existing.id));
    return;
  }
  await db.insert(categoryRule).values({ id: newId(), userId, pattern, categoryId, origin: "learned" }).onConflictDoNothing();
}
