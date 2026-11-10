"use server";

import { db, session, user } from "@gp/db";
import { and, eq, ne } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

/** Bloquea una cuenta y cierra todas sus sesiones. No aplica a ti ni a otros administradores. */
export async function blockUserAction(form: FormData) {
  const { user: admin } = await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id || id === admin.id) return;
  await db.transaction(async (tx) => {
    const [u] = await tx
      .update(user)
      .set({ blockedAt: new Date() })
      .where(and(eq(user.id, id), ne(user.role, "admin")))
      .returning({ id: user.id });
    if (u) await tx.delete(session).where(eq(session.userId, u.id));
  });
  revalidatePath("/app/usuarios");
}

export async function unblockUserAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await db.update(user).set({ blockedAt: null }).where(eq(user.id, id));
  revalidatePath("/app/usuarios");
}
