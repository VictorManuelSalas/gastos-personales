"use server";

import { addCooldown } from "@gp/core";
import { db, wishlistItem } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { fail, int, money, newId, ok, optStr, ownLine, str, type ActionState } from "./util";

/** RF-37: lo que quieres comprar espera 72 h antes de decidir. */
export async function addWishAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const product = str(f, "product");
  const price = money(f, "price");
  const months = int(f, "months", 1, 48) ?? 1;
  const line = await ownLine(user.id, str(f, "lineId") || null);
  if (!product) return fail("¿Qué quieres comprar?");
  if (price == null) return fail("Escribe el precio.");
  await db.insert(wishlistItem).values({
    id: newId(),
    userId: user.id,
    product,
    priceCents: price,
    months,
    creditLineId: line?.id ?? null,
    note: optStr(f, "note"),
    availableAt: addCooldown(),
  });
  revalidatePath("/app/deseos");
  return ok();
}

export async function decideWishAction(f: FormData) {
  const { user } = await requireUser();
  const status = str(f, "decision") === "bought" ? "bought" : "dropped";
  await db
    .update(wishlistItem)
    .set({ status, decidedAt: new Date() })
    .where(and(eq(wishlistItem.id, str(f, "id")), eq(wishlistItem.userId, user.id)));
  revalidatePath("/app/deseos");
}
