"use server";

import { randomBytes, randomUUID } from "node:crypto";
import { db, invitation } from "@gp/db";
import { and, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/session";

const INVITE_DAYS = 7; // RN-10

export type InviteState = { error: string | null; ok?: boolean };

export async function createInvitationAction(_prev: InviteState, form: FormData): Promise<InviteState> {
  const { user } = await requireAdmin();
  const email = String(form.get("email") ?? "").trim().toLowerCase() || null;
  const note = String(form.get("note") ?? "").trim().slice(0, 120) || null;

  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: "Revisa el correo: no parece válido. También puedes dejarlo vacío." };
  }

  await db.insert(invitation).values({
    id: randomUUID(),
    token: randomBytes(24).toString("base64url"),
    email,
    note,
    createdBy: user.id,
    expiresAt: new Date(Date.now() + INVITE_DAYS * 86_400_000),
  });

  revalidatePath("/app/invitaciones");
  return { error: null, ok: true };
}

export async function revokeInvitationAction(form: FormData) {
  await requireAdmin();
  const id = String(form.get("id") ?? "");
  if (!id) return;
  await db.delete(invitation).where(and(eq(invitation.id, id), isNull(invitation.usedAt)));
  revalidatePath("/app/invitaciones");
}
