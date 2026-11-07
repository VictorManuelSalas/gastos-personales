import { DEFAULT_PAYDAYS, describePaydays, parsePaydayRule } from "@gp/core";
import { db, user as userTable } from "@gp/db";
import { eq } from "drizzle-orm";
import type { Metadata } from "next";
import { signOutAction } from "@/app/(auth)/actions";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { GlassCard } from "@/components/ui/glass-card";
import { PageHeader } from "@/components/ui/page-header";
import { formatShortDateTime } from "@/lib/dates";
import { requireUser } from "@/lib/session";
import {
  connectTelegramAction,
  disconnectTelegramAction,
  registerWebhookAction,
  updatePaydaysAction,
  updateRemindersAction,
} from "@/server/actions/settings";
import { telegramConfig } from "@/server/telegram/client";
import { PushToggle } from "@/components/push-toggle";
import { updateNotifPrefsAction } from "@/server/actions/notifications";
import { pushConfig } from "@/server/notify/push";

export const metadata: Metadata = { title: "Ajustes" };

const HOURS = Array.from({ length: 24 }, (_, h) => h);

export default async function SettingsPage() {
  const { user: session } = await requireUser();
  const [u] = await db.select().from(userTable).where(eq(userTable.id, session.id));
  const rule = parsePaydayRule(u!.payDays, u!.paydayPolicy) ?? DEFAULT_PAYDAYS;
  const tg = telegramConfig();
  const linked = Boolean(u!.telegramChatId);

  return (
    <div>
      <PageHeader eyebrow="Ajustes" title="Tu cuenta." />

      <GlassCard interactive={false} className="rise d2 mt-12 divide-y divide-white/[.06] p-2">
        {[
          ["Nombre", u!.name],
          ["Correo", u!.email],
          ["Rol", u!.role === "admin" ? "Administrador" : "Usuario"],
          ["Zona horaria", "Ciudad de México"],
        ].map(([k, v]) => (
          <div key={k} className="flex items-center justify-between gap-6 px-5 py-4 text-[15px]">
            <span className="text-mist">{k}</span>
            <span className="min-w-0 truncate text-right">{v}</span>
          </div>
        ))}
      </GlassCard>

      <section className="mt-12">
        <h2 className="eyebrow">Días de cobro</h2>
        <GlassCard interactive={false} className="mt-4 p-6 md:p-8">
          <p className="text-[15px]">Cobras el {describePaydays(rule)}.</p>
          <p className="mt-1 text-[13px] text-haze">Cada pago se asigna al último cobro antes de su fecha límite.</p>
          <ActionForm action={updatePaydaysAction} resetOnOk={false} okMessage="Guardado. Tus quincenas se recalcularon." className="mt-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div>
              <label htmlFor="pd-days" className="block text-[12px] text-haze">
                Días (separados por coma)
              </label>
              <input id="pd-days" name="payDays" defaultValue={u!.payDays.replace("last", "último")} placeholder="15, último" className="field mt-1.5" />
            </div>
            <div>
              <label htmlFor="pd-policy" className="block text-[12px] text-haze">
                Si cae en fin de semana o festivo
              </label>
              <select id="pd-policy" name="policy" defaultValue={u!.paydayPolicy} className="field mt-1.5">
                <option value="none">Cobro ese mismo día</option>
                <option value="previous_business">Se adelanta al día hábil anterior</option>
              </select>
            </div>
            <SubmitButton>Guardar</SubmitButton>
          </ActionForm>
        </GlassCard>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Telegram</h2>
        <GlassCard interactive={false} className="mt-4 p-6 md:p-8">
          {!tg ? (
            <>
              <p className="text-[15px]">El bot aún no está configurado en el servidor.</p>
              <p className="mt-2 text-[13px] leading-relaxed text-haze">
                {u!.role === "admin"
                  ? "Crea un bot con @BotFather y agrega TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME y TELEGRAM_WEBHOOK_SECRET al archivo .env. Los pasos están en el README."
                  : "Pídele a quien administra el servidor que lo active."}
              </p>
            </>
          ) : linked ? (
            <div className="flex flex-wrap items-center gap-4">
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2 text-[15px]">
                  <span className="h-2 w-2 rounded-full bg-mint" />
                  Conectado con @{tg.username}
                </p>
                <p className="mt-1 text-[13px] text-haze">
                  Ahí te llegan los avisos · desde {u!.telegramLinkedAt ? formatShortDateTime(u!.telegramLinkedAt) : "hace poco"}
                </p>
              </div>
              <ActionButton action={disconnectTelegramAction} fields={{}} variant="danger">
                Desconectar
              </ActionButton>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-4">
              <p className="min-w-0 flex-1 text-[15px] text-mist">Conecta tu Telegram para recibir avisos antes de cada fecha límite.</p>
              <form action={connectTelegramAction}>
                <SubmitButton pending="Abriendo Telegram…">Conectar Telegram</SubmitButton>
              </form>
            </div>
          )}

          {tg && u!.role === "admin" ? (
            <div className="mt-6 border-t border-white/[.06] pt-5">
              <p className="text-[13px] text-haze">Administrador: después de configurar tu dominio con HTTPS, registra el webhook una vez.</p>
              <ActionForm action={registerWebhookAction} okMessage="Webhook registrado." className="mt-3">
                <SubmitButton variant="ghost">Registrar webhook</SubmitButton>
              </ActionForm>
            </div>
          ) : null}
        </GlassCard>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Avisos</h2>
        <GlassCard interactive={false} className="mt-4 p-6 md:p-8">
          <p className="text-[13px] leading-relaxed text-haze">
            Te avisamos de cada pago pendiente en los días que elijas antes de la fecha límite (0 = el mismo día, con un segundo aviso a las
            6 pm), el día siguiente si quedó vencido, el día del corte y el día de cobro.
          </p>
          <ActionForm action={updateRemindersAction} resetOnOk={false} okMessage="Guardado" className="mt-6 grid gap-4 sm:grid-cols-3 sm:items-end">
            <div>
              <label htmlFor="rm-days" className="block text-[12px] text-haze">
                Días antes de la fecha límite
              </label>
              <input id="rm-days" name="reminderDays" defaultValue={u!.reminderDays.replaceAll(",", ", ")} className="field num mt-1.5" />
            </div>
            <div>
              <label htmlFor="rm-qs" className="block text-[12px] text-haze">
                Silencio desde
              </label>
              <select id="rm-qs" name="quietStart" defaultValue={u!.quietStart} className="field mt-1.5">
                {HOURS.map((h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="rm-qe" className="block text-[12px] text-haze">
                hasta
              </label>
              <select id="rm-qe" name="quietEnd" defaultValue={u!.quietEnd} className="field mt-1.5">
                {HOURS.map((h) => (
                  <option key={h} value={h}>{`${h}:00`}</option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <SubmitButton>Guardar avisos</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>
      </section>

      <section className="mt-12">
        <h2 className="eyebrow">Notificaciones del teléfono</h2>
        <GlassCard interactive={false} className="mt-4 p-6 md:p-8">
          <PushToggle publicKey={pushConfig()?.publicKey ?? null} />
          <ActionForm action={updateNotifPrefsAction} resetOnOk={false} okMessage="Guardado" className="mt-6 grid gap-3 border-t border-white/[.06] pt-5">
            <label className="flex items-center gap-2 text-[14px] text-mist">
              <input type="checkbox" name="summaries" defaultChecked={u!.summaries} className="h-4 w-4 accent-[#8fa8ff]" />
              Resumen semanal (domingo 7 pm) y mensual (día 1)
            </label>
            <label className="flex items-center gap-2 text-[14px] text-mist">
              <input type="checkbox" name="logReminder" defaultChecked={u!.logReminder} className="h-4 w-4 accent-[#8fa8ff]" />
              Recordarme registrar si llevo 2 días sin anotar nada
            </label>
            <div>
              <SubmitButton variant="ghost">Guardar</SubmitButton>
            </div>
          </ActionForm>
        </GlassCard>
      </section>

      <form action={signOutAction} className="mt-12">
        <button type="submit" className="btn btn-danger w-full rounded-xl py-3.5 text-[15px] sm:w-auto sm:px-8">
          Cerrar sesión
        </button>
      </form>
    </div>
  );
}
