"use server";

import { APIError } from "better-auth/api";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth, INVITE_HEADER } from "@/lib/auth";

export type FormState = { error: string | null; values?: Record<string, string> };

function errorMessage(e: unknown, fallback: string) {
  if (e instanceof APIError) {
    const msg = (e.body as { message?: string } | undefined)?.message ?? "";
    if (/invalid email or password/i.test(msg)) return "El correo o la contraseña no coinciden.";
    if (/already exists/i.test(msg)) return "Ya existe una cuenta con ese correo. Inicia sesión.";
    if (/password too short/i.test(msg)) return "La contraseña debe tener al menos 8 caracteres.";
    if (/invalid email/i.test(msg)) return "Revisa el correo: no parece válido.";
    if (msg) return msg;
  }
  console.error(e);
  return fallback;
}

export async function signInAction(_prev: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim();
  const password = String(form.get("password") ?? "");
  if (!email || !password) return { error: "Escribe tu correo y tu contraseña.", values: { email } };

  try {
    await auth.api.signInEmail({ body: { email, password }, headers: await headers() });
  } catch (e) {
    return { error: errorMessage(e, "No pudimos iniciar sesión. Intenta de nuevo."), values: { email } };
  }
  redirect("/app");
}

export async function signUpAction(_prev: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const token = String(form.get("token") ?? "");
  const values = { name, email };

  if (!name || !email || !password) return { error: "Completa tu nombre, correo y contraseña.", values };
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres.", values };

  const h = new Headers(await headers());
  if (token) h.set(INVITE_HEADER, token);

  try {
    await auth.api.signUpEmail({ body: { name, email, password }, headers: h });
  } catch (e) {
    return { error: errorMessage(e, "No pudimos crear tu cuenta. Intenta de nuevo."), values };
  }
  redirect("/app");
}

export async function signOutAction() {
  await auth.api.signOut({ headers: await headers() });
  redirect("/entrar");
}
