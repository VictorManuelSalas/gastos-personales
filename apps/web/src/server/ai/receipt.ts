import Anthropic from "@anthropic-ai/sdk";

/**
 * Lee la foto de un ticket con Claude (visión) y devuelve total, comercio y fecha.
 * Solo se envía la imagen; ningún dato del usuario (RNF-03).
 */

export type ReceiptData = {
  totalCents: number;
  merchant: string | null;
  date: string | null;
  /** Qué tan seguro está el modelo del total. */
  confidence: "high" | "medium" | "low";
};

export type ReceiptResult = { ok: true; data: ReceiptData } | { ok: false; reason: "not_configured" | "unreadable" | "refused" | "error" };

const TOOL: Anthropic.Beta.BetaTool = {
  name: "registrar_ticket",
  description: "Registra los datos leídos de un ticket o recibo de compra mexicano.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      total: { type: "number", description: "Total pagado en pesos mexicanos (el monto final, con impuestos y propina si aparece)." },
      merchant: { type: ["string", "null"], description: "Nombre comercial del negocio, corto (p. ej. OXXO, Chedraui, Starbucks)." },
      date: { type: ["string", "null"], description: "Fecha de la compra en formato YYYY-MM-DD, o null si no se ve." },
      confidence: { type: "string", enum: ["high", "medium", "low"], description: "Qué tan legible es el total." },
      readable: { type: "boolean", description: "false si la imagen no es un ticket o no se puede leer el total." },
    },
    required: ["total", "merchant", "date", "confidence", "readable"],
    additionalProperties: false,
  },
};

export function receiptsEnabled() {
  return Boolean(process.env.ANTHROPIC_API_KEY || process.env.ANTHROPIC_AUTH_TOKEN);
}

export async function readReceipt(imageBase64: string, mediaType: "image/jpeg" | "image/png" | "image/webp"): Promise<ReceiptResult> {
  if (!receiptsEnabled()) return { ok: false, reason: "not_configured" };
  const client = new Anthropic();
  try {
    const response = await client.beta.messages.create({
      model: "claude-opus-5-5",
      max_tokens: 2000,
      output_config: { effort: "low" },
      // Si el modelo rechaza la solicitud, el servidor la reintenta con el modelo de respaldo recomendado.
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      tools: [TOOL],
      tool_choice: { type: "auto" },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: imageBase64 } },
            {
              type: "text",
              text: "Lee este ticket de compra y llama a la herramienta registrar_ticket con el total, el comercio y la fecha. Si no es un ticket o no se lee el total, llama la herramienta con readable en false y total 0.",
            },
          ],
        },
      ],
    });

    if (response.stop_reason === "refusal") return { ok: false, reason: "refused" };
    const call = response.content.find((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use" && b.name === TOOL.name);
    if (!call) return { ok: false, reason: "unreadable" };
    const input = call.input as { total?: unknown; merchant?: unknown; date?: unknown; confidence?: unknown; readable?: unknown };
    const total = typeof input.total === "number" ? Math.round(input.total * 100) : 0;
    if (input.readable === false || total <= 0) return { ok: false, reason: "unreadable" };
    return {
      ok: true,
      data: {
        totalCents: total,
        merchant: typeof input.merchant === "string" && input.merchant.trim() ? input.merchant.trim().slice(0, 60) : null,
        date: typeof input.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(input.date) ? input.date : null,
        confidence: input.confidence === "high" || input.confidence === "medium" ? input.confidence : "low",
      },
    };
  } catch (e) {
    if (e instanceof Anthropic.AuthenticationError) return { ok: false, reason: "not_configured" };
    if (e instanceof Anthropic.APIError) console.error(`[ticket] API ${e.status}:`, e.message);
    else console.error("[ticket]", e);
    return { ok: false, reason: "error" };
  }
}
