/**
 * Cliente mínimo de la API de Bots de Telegram (sin dependencias).
 * Fase 1: avisos y comandos. Fase 2: registro de gastos en lenguaje natural.
 */

export function telegramConfig() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const username = process.env.TELEGRAM_BOT_USERNAME?.replace(/^@/, "");
  if (!token || !username) return null;
  return { token, username, secret: process.env.TELEGRAM_WEBHOOK_SECRET ?? "" };
}

type Button = [text: string, callbackData: string];

async function call<T = unknown>(method: string, body: Record<string, unknown>): Promise<{ ok: boolean; result?: T; description?: string }> {
  const cfg = telegramConfig();
  if (!cfg) return { ok: false, description: "Telegram no está configurado" };
  try {
    const res = await fetch(`https://api.telegram.org/bot${cfg.token}/${method}`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(10_000),
    });
    return (await res.json()) as { ok: boolean; result?: T; description?: string };
  } catch (e) {
    return { ok: false, description: e instanceof Error ? e.message : "Error de red" };
  }
}

export function sendMessage(chatId: string | number, text: string, buttons?: Button[]) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: buttons?.length ? { inline_keyboard: [buttons.map(([t, d]) => ({ text: t, callback_data: d }))] } : undefined,
  });
}

export function answerCallback(id: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

export function editMessageText(chatId: string | number, messageId: number, text: string) {
  return call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML" });
}

export function setWebhook(url: string, secret: string) {
  return call("setWebhook", {
    url,
    secret_token: secret || undefined,
    allowed_updates: ["message", "callback_query"],
    drop_pending_updates: false,
  });
}

export function getWebhookInfo() {
  return call<{ url: string; pending_update_count: number; last_error_message?: string }>("getWebhookInfo", {});
}

/** Escapa texto del usuario para parse_mode HTML. */
export const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
