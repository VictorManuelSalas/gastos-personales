import { db, user } from "@gp/db";
import { eq } from "drizzle-orm";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) return null;
  // La sesión puede venir de la caché de la cookie (5 min): el bloqueo se revisa siempre en la BD.
  const [u] = await db.select({ blockedAt: user.blockedAt }).from(user).where(eq(user.id, s.user.id));
  return u && !u.blockedAt ? s : null;
}

export async function requireUser() {
  const s = await getSession();
  if (!s) redirect("/entrar");
  return s;
}

export async function requireAdmin() {
  const s = await requireUser();
  if (s.user.role !== "admin") redirect("/app");
  return s;
}
