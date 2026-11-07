"use server";

import type { AiProvider } from "@gp/core";
import { db, userAiSetting } from "@gp/db";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { requireUser } from "@/lib/session";
import { decryptSecret, encryptSecret, keyHint } from "@/server/ai/crypto";
import { FAILURE_TEXT, testAiKey } from "@/server/ai/receipt";
import { fail, ok, optStr, str, type ActionState } from "./util";

const PROVIDERS: AiProvider[] = ["gemini", "openai", "anthropic"];

/**
 * Guarda el proveedor de IA del usuario. La llave se valida con el proveedor antes de
 * guardarla, se cifra (AES-256-GCM) y nunca se vuelve a mostrar: solo sus últimos 4 caracteres.
 * Si se deja vacía se conserva la anterior (si es del mismo proveedor).
 */
export async function saveAiSettingAction(_p: ActionState, f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const provider = str(f, "provider") as AiProvider;
  if (!PROVIDERS.includes(provider)) return fail("Elige un proveedor.");
  const model = optStr(f, "model");
  if (model && !/^[\w.:\/-]{2,80}$/.test(model)) return fail("El nombre del modelo no es válido.");
  const apiKey = str(f, "apiKey").replace(/\s+/g, "");
  if (apiKey && (apiKey.length < 20 || apiKey.length > 300)) return fail("Esa API key no parece válida.");

  const [prev] = await db.select().from(userAiSetting).where(eq(userAiSetting.userId, u.id));
  let encryptedKey = prev?.provider === provider ? prev.encryptedKey : null;
  let hint = prev?.provider === provider ? prev.keyHint : null;

  if (apiKey) {
    const test = await testAiKey(provider, apiKey);
    if (!test.ok) return fail(test.reason === "invalid_key" ? "El proveedor rechazó esa API key." : FAILURE_TEXT[test.reason ?? "error"]);
    encryptedKey = encryptSecret(apiKey);
    hint = keyHint(apiKey);
  }

  const values = { provider, model, encryptedKey, keyHint: hint, updatedAt: new Date() };
  await db.insert(userAiSetting).values({ userId: u.id, ...values }).onConflictDoUpdate({ target: userAiSetting.userId, set: values });
  revalidatePath("/app/ajustes");
  return ok();
}

export async function testAiSettingAction(_p: ActionState, _f: FormData): Promise<ActionState> {
  const { user: u } = await requireUser();
  const [s] = await db.select().from(userAiSetting).where(eq(userAiSetting.userId, u.id));
  if (!s?.encryptedKey) return fail("No tienes una API key guardada.");
  const key = decryptSecret(s.encryptedKey);
  if (!key) return fail("No se pudo leer tu llave guardada (cambió la llave de cifrado del servidor). Captúrala de nuevo.");
  const test = await testAiKey(s.provider, key);
  return test.ok ? ok() : fail(test.reason === "invalid_key" ? "El proveedor rechazó tu API key." : FAILURE_TEXT[test.reason ?? "error"]);
}

export async function deleteAiSettingAction(_f: FormData) {
  const { user: u } = await requireUser();
  await db.delete(userAiSetting).where(eq(userAiSetting.userId, u.id));
  revalidatePath("/app/ajustes");
}
