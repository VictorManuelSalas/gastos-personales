"use server";

import type { AiProvider } from "@gp/core";
import { db, userAiSetting } from "@gp/db";
import { and, desc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { decryptSecret, encryptSecret, keyHint } from "@/server/ai/crypto";
import { FAILURE_TEXT, testAiKey } from "@/server/ai/receipt";
import { fail, ok, optStr, str, type ActionState } from "./util";

const PROVIDERS: AiProvider[] = ["gemini", "openai", "anthropic"];

const byProvider = (userId: string, provider: AiProvider) => and(eq(userAiSetting.userId, userId), eq(userAiSetting.provider, provider));

/**
 * Guarda la llave de un proveedor (una por proveedor). La llave se valida con el proveedor antes de
 * guardarla, se cifra (AES-256-GCM) y nunca se vuelve a mostrar: solo sus últimos 4 caracteres.
 * Si se deja vacía se conserva la que ya tenía ese proveedor. La primera que se agrega queda como principal.
 */
export async function saveAiSettingAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const provider = str(f, "provider") as AiProvider;
  if (!PROVIDERS.includes(provider)) return fail("Elige un proveedor.");
  const model = optStr(f, "model");
  if (model && !/^[\w.:\/-]{2,80}$/.test(model)) return fail("El nombre del modelo no es válido.");
  const apiKey = str(f, "apiKey").replace(/\s+/g, "");
  if (apiKey && (apiKey.length < 20 || apiKey.length > 300)) return fail("Esa API key no parece válida.");

  const rows = await db.select().from(userAiSetting).where(eq(userAiSetting.userId, u.id));
  const prev = rows.find((r) => r.provider === provider);
  let encryptedKey = prev?.encryptedKey ?? null;
  let hint = prev?.keyHint ?? null;

  if (apiKey) {
    const test = await testAiKey(provider, apiKey);
    if (!test.ok) return fail(test.reason === "invalid_key" ? "El proveedor rechazó esa API key." : FAILURE_TEXT[test.reason ?? "error"]);
    encryptedKey = encryptSecret(apiKey);
    hint = keyHint(apiKey);
  }

  const values = { model, encryptedKey, keyHint: hint, updatedAt: new Date() };
  const isPrimary = prev?.isPrimary ?? !rows.some((r) => r.isPrimary);
  await db
    .insert(userAiSetting)
    .values({ userId: u.id, provider, isPrimary, ...values })
    .onConflictDoUpdate({ target: [userAiSetting.userId, userAiSetting.provider], set: values });
  revalidatePath("/app/ajustes");
  return ok();
}

export async function testAiSettingAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const provider = str(f, "provider") as AiProvider;
  const [s] = await db.select().from(userAiSetting).where(byProvider(u.id, provider));
  if (!s?.encryptedKey) return fail("No tienes una API key guardada para este proveedor.");
  const key = decryptSecret(s.encryptedKey);
  if (!key) return fail("No se pudo leer tu llave guardada (cambió la llave de cifrado del servidor). Captúrala de nuevo.");
  const test = await testAiKey(s.provider, key);
  return test.ok ? ok() : fail(test.reason === "invalid_key" ? "El proveedor rechazó tu API key." : FAILURE_TEXT[test.reason ?? "error"]);
}

export async function setPrimaryAiAction(f: FormData) {
  const { user: u } = await requireUser();
  const provider = str(f, "provider") as AiProvider;
  if (!PROVIDERS.includes(provider)) return;
  await db.transaction(async (tx) => {
    await tx.update(userAiSetting).set({ isPrimary: false }).where(eq(userAiSetting.userId, u.id));
    await tx.update(userAiSetting).set({ isPrimary: true }).where(byProvider(u.id, provider));
  });
  revalidatePath("/app/ajustes");
}

/** Borra la llave de un proveedor. Si era la principal, la más reciente que quede pasa a serlo. */
export async function deleteAiSettingAction(f: FormData) {
  const { user: u } = await requireUser();
  const provider = str(f, "provider") as AiProvider;
  await db.transaction(async (tx) => {
    const [gone] = await tx.delete(userAiSetting).where(byProvider(u.id, provider)).returning();
    if (!gone?.isPrimary) return;
    const [next] = await tx.select().from(userAiSetting).where(eq(userAiSetting.userId, u.id)).orderBy(desc(userAiSetting.updatedAt)).limit(1);
    if (next) await tx.update(userAiSetting).set({ isPrimary: true }).where(byProvider(u.id, next.provider));
  });
  revalidatePath("/app/ajustes");
}
