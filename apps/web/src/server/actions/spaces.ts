"use server";

import { today } from "@gp/core";
import { db, sharedExpense, space, spaceGoal, spaceGoalContribution, spaceMember, user } from "@gp/db";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { addSharedExpense, isMember, spaceDetail } from "@/server/finance/spaces";
import { fail, isoDate, money, newId, ok, str, type ActionState } from "./util";

export async function createSpaceAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const name = str(f, "name");
  if (!name) return fail("Ponle nombre, por ejemplo Casa o Viaje con amigos.");
  const id = newId();
  await db.transaction(async (tx) => {
    await tx.insert(space).values({ id, name, createdBy: u.id });
    await tx.insert(spaceMember).values({ spaceId: id, userId: u.id });
  });
  redirect(`/app/espacios/${id}`);
}

/** Agrega a alguien que ya tiene cuenta en este servidor (por su correo). */
export async function addMemberAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  if (!(await isMember(spaceId, u.id))) return fail("No perteneces a este espacio.");
  const email = str(f, "email").toLowerCase();
  const [other] = await db.select().from(user).where(eq(user.email, email));
  if (!other) return fail("No hay ninguna cuenta con ese correo en este servidor. Invítala primero desde Invitaciones.");
  await db.insert(spaceMember).values({ spaceId, userId: other.id }).onConflictDoNothing();
  revalidatePath(`/app/espacios/${spaceId}`);
  return ok();
}

export async function addSharedExpenseAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  const d = await spaceDetail(spaceId, u.id);
  if (!d) return fail("No perteneces a este espacio.");
  const amount = money(f, "amount");
  const concept = str(f, "concept");
  const paidBy = str(f, "paidBy") || u.id;
  const participants = f.getAll("participants").map(String).filter((id) => d.members.some((m) => m.id === id));
  if (!concept) return fail("¿Qué se pagó?");
  if (amount == null) return fail("Escribe el monto.");
  if (!d.members.some((m) => m.id === paidBy)) return fail("Quien pagó debe ser miembro del espacio.");
  if (!participants.length) return fail("Elige entre quiénes se divide.");
  await addSharedExpense({ spaceId, paidBy, concept, amountCents: amount, participants });
  revalidatePath(`/app/espacios/${spaceId}`);
  return ok();
}

/** Registra un pago entre miembros para quedar a mano. */
export async function settleAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  const d = await spaceDetail(spaceId, u.id);
  if (!d) return fail("No perteneces a este espacio.");
  const from = str(f, "from");
  const to = str(f, "to");
  const amount = money(f, "amount");
  if (!d.members.some((m) => m.id === from) || !d.members.some((m) => m.id === to) || from === to) return fail("Elige a dos miembros distintos.");
  if (amount == null) return fail("Escribe el monto.");
  await db.insert(sharedExpense).values({
    id: newId(),
    spaceId,
    paidBy: from,
    paidTo: to,
    kind: "settlement",
    concept: "Pago para saldar",
    amountCents: amount,
    date: isoDate(f, "date") ?? today(),
  });
  revalidatePath(`/app/espacios/${spaceId}`);
  return ok();
}

export async function deleteSharedExpenseAction(f: FormData) {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  if (!(await isMember(spaceId, u.id))) return;
  await db.delete(sharedExpense).where(and(eq(sharedExpense.id, str(f, "id")), eq(sharedExpense.spaceId, spaceId)));
  revalidatePath(`/app/espacios/${spaceId}`);
}

export async function createSpaceGoalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  if (!(await isMember(spaceId, u.id))) return fail("No perteneces a este espacio.");
  const name = str(f, "name");
  const target = money(f, "target");
  if (!name || target == null) return fail("Escribe el nombre y el objetivo.");
  await db.insert(spaceGoal).values({ id: newId(), spaceId, name, emoji: str(f, "emoji").slice(0, 4) || "🎯", targetCents: target, targetDate: isoDate(f, "targetDate") });
  revalidatePath(`/app/espacios/${spaceId}`);
  return ok();
}

export async function contributeSpaceGoalAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const spaceId = str(f, "spaceId");
  if (!(await isMember(spaceId, u.id))) return fail("No perteneces a este espacio.");
  const [g] = await db.select().from(spaceGoal).where(and(eq(spaceGoal.id, str(f, "goalId")), eq(spaceGoal.spaceId, spaceId)));
  const amount = money(f, "amount");
  if (!g) return fail("No encontramos esa meta.");
  if (amount == null) return fail("Escribe cuánto aportas.");
  await db.insert(spaceGoalContribution).values({ id: newId(), goalId: g.id, userId: u.id, amountCents: amount, date: today() });
  revalidatePath(`/app/espacios/${spaceId}`);
  return ok();
}

export async function leaveSpaceAction(f: FormData) {
  const { user: u } = await requireUser();
  await db.delete(spaceMember).where(and(eq(spaceMember.spaceId, str(f, "spaceId")), eq(spaceMember.userId, u.id)));
  redirect("/app/espacios");
}
