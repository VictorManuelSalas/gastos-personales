import { timingSafeEqual } from "node:crypto";
import { telegramConfig } from "@/server/telegram/client";
import { handleUpdate } from "@/server/telegram/handlers";

export const dynamic = "force-dynamic";

function validSecret(got: string | null, expected: string) {
  if (!expected) return true;
  if (!got || got.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(got), Buffer.from(expected));
}

/** Webhook del bot. Telegram reintenta si no respondemos 200, así que los errores se registran y se responde OK. */
export async function POST(req: Request) {
  const cfg = telegramConfig();
  if (!cfg) return new Response("Telegram no configurado", { status: 503 });
  if (!validSecret(req.headers.get("x-telegram-bot-api-secret-token"), cfg.secret)) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    await handleUpdate(await req.json());
  } catch (e) {
    console.error("[telegram]", e);
  }
  return Response.json({ ok: true });
}
