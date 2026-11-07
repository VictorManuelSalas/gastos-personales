import Anthropic from "@anthropic-ai/sdk";
import { AI_DEFAULT_MODELS, normalizeReceipt, RECEIPT_PROMPT, supportsVoice, type AiProvider, type ReceiptData } from "@gp/core";
import { db, userAiSetting } from "@gp/db";
import { eq } from "drizzle-orm";
import { decryptSecret } from "./crypto";

/**
 * IA por usuario: cada quien puede usar su propia llave de Gemini, OpenAI o Claude
 * (Ajustes → Inteligencia artificial). Si no tiene, se usa la del servidor (.env).
 * Solo se envía la foto o el audio; ningún dato del usuario (RNF-03).
 */

export type AiFailure = "not_configured" | "invalid_key" | "quota" | "unreadable" | "refused" | "no_voice" | "error";
export type ReceiptResult = { ok: true; data: ReceiptData; provider: AiProvider } | { ok: false; reason: AiFailure };
export type TranscriptResult = { ok: true; text: string; provider: AiProvider } | { ok: false; reason: AiFailure };

type Resolved = { provider: AiProvider; model: string; apiKey: string; source: "user" | "server" };

const ENV_KEYS: Record<AiProvider, string | undefined> = {
  get gemini() {
    return process.env.GEMINI_API_KEY;
  },
  get openai() {
    return process.env.OPENAI_API_KEY;
  },
  get anthropic() {
    return process.env.ANTHROPIC_API_KEY;
  },
};

/** Proveedor del servidor: AI_PROVIDER si tiene llave, si no el primero con llave. */
export function serverAi(): { provider: AiProvider; apiKey: string } | null {
  const pref = process.env.AI_PROVIDER as AiProvider | undefined;
  const order: AiProvider[] = pref && ENV_KEYS[pref] ? [pref] : ["gemini", "openai", "anthropic"];
  for (const p of order) if (ENV_KEYS[p]) return { provider: p, apiKey: ENV_KEYS[p]! };
  return null;
}

export async function resolveAi(userId: string): Promise<Resolved | null> {
  const [s] = await db.select().from(userAiSetting).where(eq(userAiSetting.userId, userId));
  if (s?.encryptedKey) {
    const key = decryptSecret(s.encryptedKey);
    if (key) return { provider: s.provider, model: s.model || AI_DEFAULT_MODELS[s.provider], apiKey: key, source: "user" };
  }
  // Eligió proveedor pero sin llave propia: usar la del servidor para ese proveedor.
  if (s && ENV_KEYS[s.provider]) return { provider: s.provider, model: s.model || AI_DEFAULT_MODELS[s.provider], apiKey: ENV_KEYS[s.provider]!, source: "server" };
  const srv = serverAi();
  return srv ? { ...srv, model: AI_DEFAULT_MODELS[srv.provider], source: "server" } : null;
}

const failureFromStatus = (status: number): AiFailure => (status === 401 || status === 403 ? "invalid_key" : status === 429 ? "quota" : "error");

// ── Gemini (REST) ────────────────────────────────────────────────────────────────

async function geminiGenerate(r: Resolved, parts: unknown[], json: boolean) {
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(r.model)}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": r.apiKey },
    body: JSON.stringify({ contents: [{ role: "user", parts }], generationConfig: json ? { responseMimeType: "application/json" } : {} }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return { ok: false as const, reason: failureFromStatus(res.status), detail: await res.text() };
  const body = (await res.json()) as { candidates?: { content?: { parts?: { text?: string }[] } }[] };
  const text = body.candidates?.[0]?.content?.parts?.map((p) => p.text ?? "").join("") ?? "";
  return { ok: true as const, text };
}

// ── OpenAI (REST) ────────────────────────────────────────────────────────────────

async function openaiReceipt(r: Resolved, base64: string, mediaType: string) {
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${r.apiKey}` },
    body: JSON.stringify({
      model: r.model,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: RECEIPT_PROMPT },
            { type: "image_url", image_url: { url: `data:${mediaType};base64,${base64}` } },
          ],
        },
      ],
    }),
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return { ok: false as const, reason: failureFromStatus(res.status), detail: await res.text() };
  const body = (await res.json()) as { choices?: { message?: { content?: string } }[] };
  return { ok: true as const, text: body.choices?.[0]?.message?.content ?? "" };
}

async function openaiTranscribe(r: Resolved, audio: Buffer, mime: string) {
  const form = new FormData();
  form.append("model", process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1");
  form.append("language", "es");
  form.append("prompt", "Gastos con cantidades en dígitos: tacos 180 nu, súper 1250 efectivo, gasolina 900.");
  form.append("file", new Blob([new Uint8Array(audio)], { type: mime }), mime.includes("ogg") ? "voz.ogg" : "voz.m4a");
  const res = await fetch("https://api.openai.com/v1/audio/transcriptions", {
    method: "POST",
    headers: { authorization: `Bearer ${r.apiKey}` },
    body: form,
    signal: AbortSignal.timeout(45_000),
  });
  if (!res.ok) return { ok: false as const, reason: failureFromStatus(res.status), detail: await res.text() };
  const body = (await res.json()) as { text?: string };
  return { ok: true as const, text: body.text ?? "" };
}

// ── Claude (SDK oficial) ─────────────────────────────────────────────────────────

const CLAUDE_TOOL: Anthropic.Beta.BetaTool = {
  name: "registrar_ticket",
  description: "Registra los datos leídos de un ticket o recibo de compra mexicano.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      total: { type: "number", description: "Total pagado en pesos mexicanos." },
      merchant: { type: ["string", "null"], description: "Nombre comercial corto del negocio." },
      date: { type: ["string", "null"], description: "Fecha YYYY-MM-DD o null." },
      confidence: { type: "string", enum: ["high", "medium", "low"] },
      readable: { type: "boolean", description: "false si no es un ticket o no se lee el total." },
    },
    required: ["total", "merchant", "date", "confidence", "readable"],
    additionalProperties: false,
  },
};

async function claudeReceipt(r: Resolved, base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<ReceiptResult> {
  const client = new Anthropic({ apiKey: r.apiKey });
  try {
    const response = await client.beta.messages.create({
      model: r.model,
      max_tokens: 2000,
      output_config: { effort: "low" },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [CLAUDE_TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
            { type: "text", text: "Lee este ticket y llama a la herramienta registrar_ticket. Si no es un ticket, llámala con readable en false y total 0." },
          ],
        },
      ],
    });
    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const call = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    const data = call ? normalizeReceipt(call.input) : null;
    return data ? { ok: true, data, provider: "anthropic" } : { ok: false, reason: "unreadable" };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "invalid_key" };
    if (e instanceof Anthropic.RateLimitError) return { ok: false, reason: "quota" };
    console.error("[ia] claude", e instanceof Anthropic.APIError ? e.status : "", (e as Error).message);
    return { ok: false, reason: "error" };
  }
}

// ── API pública ──────────────────────────────────────────────────────────────────

export async function readReceipt(userId: string, base64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<ReceiptResult> {
  const r = await resolveAi(userId);
  if (!r) return { ok: false, reason: "not_configured" };
  try {
    if (r.provider === "anthropic") return await claudeReceipt(r, base64, mediaType);
    const out =
      r.provider === "gemini"
        ? await geminiGenerate(r, [{ inlineData: { mimeType: mediaType, data: base64 } }, { text: RECEIPT_PROMPT }], true)
        : await openaiReceipt(r, base64, mediaType);
    if (!out.ok) {
      console.error(`[ia] ${r.provider}`, out.reason, out.detail.slice(0, 200));
      return { ok: false, reason: out.reason };
    }
    const data = normalizeReceipt(out.text);
    return data ? { ok: true, data, provider: r.provider } : { ok: false, reason: "unreadable" };
  } catch (e) {
    console.error(`[ia] ${r.provider}`, (e as Error).message);
    return { ok: false, reason: "error" };
  }
}

/** Nota de voz → texto (Gemini u OpenAI). */
export async function transcribe(userId: string, audio: Buffer, mime: string): Promise<TranscriptResult> {
  const r = await resolveAi(userId);
  if (!r) return { ok: false, reason: "not_configured" };
  if (!supportsVoice(r.provider)) return { ok: false, reason: "no_voice" };
  try {
    const out =
      r.provider === "gemini"
        ? await geminiGenerate(
            r,
            [{ inlineData: { mimeType: mime, data: audio.toString("base64") } }, { text: "Transcribe este audio en español. Escribe las cantidades con dígitos (ciento ochenta → 180). Responde solo con la transcripción, sin comillas." }],
            false,
          )
        : await openaiTranscribe(r, audio, mime);
    if (!out.ok) {
      console.error(`[ia] ${r.provider} voz`, out.reason, out.detail.slice(0, 200));
      return { ok: false, reason: out.reason };
    }
    const text = out.text.trim();
    return text ? { ok: true, text, provider: r.provider } : { ok: false, reason: "unreadable" };
  } catch (e) {
    console.error(`[ia] ${r.provider} voz`, (e as Error).message);
    return { ok: false, reason: "error" };
  }
}

/** Valida una llave sin gastar: lista los modelos disponibles. */
export async function testAiKey(provider: AiProvider, apiKey: string): Promise<{ ok: boolean; reason?: AiFailure }> {
  try {
    if (provider === "anthropic") {
      const client = new Anthropic({ apiKey });
      await client.models.list();
      return { ok: true };
    }
    const res =
      provider === "gemini"
        ? await fetch("https://generativelanguage.googleapis.com/v1beta/models?pageSize=1", { headers: { "x-goog-api-key": apiKey }, signal: AbortSignal.timeout(15_000) })
        : await fetch("https://api.openai.com/v1/models", { headers: { authorization: `Bearer ${apiKey}` }, signal: AbortSignal.timeout(15_000) });
    // Gemini responde 400 con llave inválida.
    if (res.ok) return { ok: true };
    return { ok: false, reason: res.status === 400 || res.status === 401 || res.status === 403 ? "invalid_key" : failureFromStatus(res.status) };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError || e instanceof Anthropic.PermissionDeniedError) return { ok: false, reason: "invalid_key" };
    return { ok: false, reason: "error" };
  }
}

export const FAILURE_TEXT: Record<AiFailure, string> = {
  not_configured: "No hay una IA configurada. Agrega tu API key en Más → Ajustes → Inteligencia artificial.",
  invalid_key: "Tu API key fue rechazada. Revísala en Más → Ajustes → Inteligencia artificial.",
  quota: "Tu cuenta de IA llegó a su límite de uso. Revisa tu saldo o cuota con el proveedor.",
  unreadable: "No pude leerlo bien. Intenta de nuevo con más luz o escríbelo, por ejemplo: <b>súper 450 nu</b>.",
  refused: "La IA no pudo procesar esta imagen. Escríbelo, por ejemplo: <b>súper 450 nu</b>.",
  no_voice: "Tu IA (Claude) no entiende audio. Usa Gemini u OpenAI en Ajustes para mandar notas de voz, o escríbelo.",
  error: "No pude procesarlo en este momento. Intenta de nuevo o escríbelo.",
};
