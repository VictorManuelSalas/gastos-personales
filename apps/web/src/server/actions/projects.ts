"use server";

import { monthStart, today } from "@gp/core";
import { category, db, moneyAccount, project, projectClient, transaction } from "@gp/db";
import { and, desc, eq, isNull } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { recordTransaction } from "@/server/finance/mutations";
import { applyTags, upsertTag } from "@/server/finance/tags";
import { fail, money, newId, ok, optMoney, ownAccount, ownLine, str, type ActionState } from "./util";

async function ownProject(userId: string, id: string) {
  const [p] = await db.select().from(project).where(and(eq(project.id, id), eq(project.userId, userId)));
  return p ?? null;
}

export async function createProjectAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const name = str(f, "name");
  const investment = optMoney(f, "investment");
  if (!name) return fail("Ponle nombre, por ejemplo Reventa de internet.");
  if (investment === undefined) return fail("Revisa la inversión: escribe solo números.");
  const tg = await upsertTag(user.id, name);
  if (!tg) return fail("Ese nombre no sirve; usa letras y números.");
  const account = await ownAccount(user.id, str(f, "accountId") || null);
  const id = newId();
  await db.insert(project).values({ id, userId: user.id, name, investmentCents: investment ?? 0, tagId: tg.id, accountId: account?.id ?? null });
  redirect(`/app/proyectos/${id}`);
}

export async function addClientAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const p = await ownProject(user.id, str(f, "projectId"));
  const name = str(f, "name");
  const monthly = money(f, "monthly");
  if (!p) return fail("No encontramos el proyecto.");
  if (!name || monthly == null) return fail("Escribe el nombre del cliente y su cobro mensual.");
  await db.insert(projectClient).values({ id: newId(), projectId: p.id, name, monthlyCents: monthly });
  revalidatePath(`/app/proyectos/${p.id}`);
  return ok();
}

/** Cobra la mensualidad de un cliente: ingreso a la cuenta del proyecto con su etiqueta. */
export async function chargeClientAction(f: FormData) {
  const { user } = await requireUser();
  const p = await ownProject(user.id, str(f, "projectId"));
  if (!p) return;
  const [c] = await db.select().from(projectClient).where(and(eq(projectClient.id, str(f, "clientId")), eq(projectClient.projectId, p.id)));
  if (!c) return;
  const [acc] = p.accountId
    ? [{ id: p.accountId }]
    : await db
        .select({ id: moneyAccount.id })
        .from(moneyAccount)
        .where(and(eq(moneyAccount.userId, user.id), isNull(moneyAccount.archivedAt)))
        .orderBy(desc(moneyAccount.isDefault))
        .limit(1);
  const [cat] = await db.select({ id: category.id }).from(category).where(and(eq(category.userId, user.id), eq(category.name, "Negocio")));
  const id = await recordTransaction({
    userId: user.id,
    kind: "income",
    amountCents: c.monthlyCents,
    accountId: acc?.id ?? null,
    categoryId: cat?.id ?? null,
    merchant: c.name,
    note: `Cobro ${p.name}`,
  });
  await db.update(transaction).set({ periodDate: monthStart(today()) }).where(eq(transaction.id, id));
  await applyTags(user.id, id, [(await upsertTag(user.id, p.name))!.name]);
  revalidatePath(`/app/proyectos/${p.id}`);
}

export async function toggleClientAction(f: FormData) {
  const { user } = await requireUser();
  const p = await ownProject(user.id, str(f, "projectId"));
  if (!p) return;
  await db
    .update(projectClient)
    .set({ active: str(f, "active") === "true" })
    .where(and(eq(projectClient.id, str(f, "clientId")), eq(projectClient.projectId, p.id)));
  revalidatePath(`/app/proyectos/${p.id}`);
}

/** Costo del negocio (equipo, renta del servicio…), etiquetado con el proyecto. */
export async function addCostAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const p = await ownProject(user.id, str(f, "projectId"));
  const amount = money(f, "amount");
  const concept = str(f, "concept");
  const [srcType, srcId] = str(f, "source").split(":");
  if (!p) return fail("No encontramos el proyecto.");
  if (!concept || amount == null) return fail("Escribe el concepto y el monto.");
  const account = srcType === "a" ? await ownAccount(user.id, srcId ?? null) : null;
  const line = srcType === "c" ? await ownLine(user.id, srcId ?? null) : null;
  const id = await recordTransaction({
    userId: user.id,
    kind: "expense",
    amountCents: amount,
    accountId: account?.id ?? null,
    creditLineId: line?.id ?? null,
    merchant: concept,
    note: `Costo ${p.name}`,
  });
  await applyTags(user.id, id, [(await upsertTag(user.id, p.name))!.name]);
  revalidatePath(`/app/proyectos/${p.id}`);
  return ok();
}

/** Quita el proyecto de la lista. Sus cobros y costos se quedan en Movimientos y en tus cuentas. */
export async function archiveProjectAction(f: FormData) {
  const { user } = await requireUser();
  await db
    .update(project)
    .set({ archivedAt: new Date() })
    .where(and(eq(project.id, str(f, "id")), eq(project.userId, user.id)));
  revalidatePath("/app/proyectos");
  redirect("/app/proyectos");
}

export async function updateInvestmentAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user } = await requireUser();
  const p = await ownProject(user.id, str(f, "projectId"));
  const investment = optMoney(f, "investment");
  if (!p) return fail("No encontramos el proyecto.");
  if (investment === undefined || investment === null) return fail("Escribe la inversión total.");
  await db.update(project).set({ investmentCents: investment }).where(eq(project.id, p.id));
  revalidatePath(`/app/proyectos/${p.id}`);
  return ok();
}
