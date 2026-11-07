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

/** Botones en una fila (Button[]) o en varias (Button[][]). */
const keyboard = (buttons?: Button[] | Button[][]) => {
  if (!buttons?.length) return undefined;
  const rows = (Array.isArray(buttons[0]![0]) ? buttons : [buttons]) as Button[][];
  return { inline_keyboard: rows.map((r) => r.map(([t, d]) => ({ text: t, callback_data: d }))) };
};

export function sendMessage(chatId: string | number, text: string, buttons?: Button[] | Button[][]) {
  return call("sendMessage", {
    chat_id: chatId,
    text,
    parse_mode: "HTML",
    link_preview_options: { is_disabled: true },
    reply_markup: keyboard(buttons),
  });
}

export function answerCallback(id: string, text?: string) {
  return call("answerCallbackQuery", { callback_query_id: id, text });
}

export function editMessageText(chatId: string | number, messageId: number, text: string, buttons?: Button[] | Button[][]) {
  return call("editMessageText", { chat_id: chatId, message_id: messageId, text, parse_mode: "HTML", reply_markup: keyboard(buttons) });
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

/** Descarga un archivo de Telegram (fotos de tickets). Máximo ~20 MB por límite de la API de bots. */
export async function downloadFile(fileId: string): Promise<{ data: Buffer; path: string } | null> {
  const cfg = telegramConfig();
  if (!cfg) return null;
  const info = await call<{ file_path?: string }>("getFile", { file_id: fileId });
  if (!info.ok || !info.result?.file_path) return null;
  const res = await fetch(`https://api.telegram.org/file/bot${cfg.token}/${info.result.file_path}`, { signal: AbortSignal.timeout(20_000) });
  if (!res.ok) return null;
  return { data: Buffer.from(await res.arrayBuffer()), path: info.result.file_path };
}
