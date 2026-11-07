import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export async function getSession() {
  return auth.api.getSession({ headers: await headers() });
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
