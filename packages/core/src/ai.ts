/** Normaliza lo que devuelva cualquier IA al leer un ticket (Gemini, OpenAI o Claude). */

export type AiProvider = "gemini" | "openai" | "anthropic";

export const AI_DEFAULT_MODELS: Record<AiProvider, string> = {
  gemini: "gemini-2.5-flash",
  openai: "gpt-4o-mini",
  anthropic: "claude-opus-5-5",
};

export const AI_LABELS: Record<AiProvider, string> = {
  gemini: "Google Gemini",
  openai: "OpenAI (ChatGPT)",
  anthropic: "Anthropic (Claude)",
};

/** ¿El proveedor entiende notas de voz? (Claude no recibe audio.) */
export const supportsVoice = (p: AiProvider) => p === "gemini" || p === "openai";

export type ReceiptData = { totalCents: number; merchant: string | null; date: string | null; confidence: "high" | "medium" | "low" };

/** Instrucción común para todos los proveedores. */
export const RECEIPT_PROMPT =
  "Lee este ticket o recibo de compra mexicano. Responde solo con JSON: " +
  '{"total": número en pesos (monto final pagado), "merchant": nombre comercial corto o null, ' +
  '"date": "YYYY-MM-DD" o null, "confidence": "high"|"medium"|"low", "readable": true|false}. ' +
  'Si no es un ticket o no se lee el total, usa readable false y total 0.';

/** JSON del modelo → datos validados, o null si no se pudo leer. */
export function normalizeReceipt(raw: unknown): ReceiptData | null {
  let obj = raw;
  if (typeof obj === "string") {
    const m = obj.match(/\{[\s\S]*\}/);
    if (!m) return null;
    try {
      obj = JSON.parse(m[0]);
    } catch {
      return null;
    }
  }
  if (!obj || typeof obj !== "object") return null;
  const o = obj as Record<string, unknown>;
  const totalNum = typeof o.total === "number" ? o.total : typeof o.total === "string" ? Number(o.total.replace(/[$,\s]/g, "")) : NaN;
  if (o.readable === false || !Number.isFinite(totalNum) || totalNum <= 0) return null;
  return {
    totalCents: Math.round(totalNum * 100),
    merchant: typeof o.merchant === "string" && o.merchant.trim() ? o.merchant.trim().slice(0, 60) : null,
    date: typeof o.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(o.date) ? o.date : null,
    confidence: o.confidence === "high" || o.confidence === "medium" ? o.confidence : "low",
  };
}
