"use client";

import { AI_DEFAULT_MODELS, AI_LABELS, supportsVoice, type AiProvider } from "@gp/core";
import { useRef, useState } from "react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { deleteAiSettingAction, saveAiSettingAction, setPrimaryAiAction, testAiSettingAction } from "@/server/actions/ai";

const KEY_URL: Record<AiProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
};

type Key = { provider: AiProvider; model: string | null; keyHint: string | null; isPrimary: boolean };

type Props = {
  /** Llaves del usuario, una por proveedor. */
  keys: Key[];
  /** Proveedor que da el servidor cuando el usuario no tiene llave propia. */
  server: AiProvider | null;
  /** Proveedores para los que el servidor tiene llave. */
  serverKeys: AiProvider[];
};

export function AiSettingsForm({ keys, server, serverKeys }: Props) {
  const primary = keys.find((k) => k.isPrimary) ?? null;
  const [provider, setProvider] = useState<AiProvider>(primary?.provider ?? server ?? "gemini");
  const formRef = useRef<HTMLDivElement>(null);
  const current = keys.find((k) => k.provider === provider) ?? null;
  const hasOwnKey = !!current?.keyHint;
  const effective = hasOwnKey ? "tu llave" : serverKeys.includes(provider) ? "la llave del servidor" : null;
  const inUse = primary ?? (server ? { provider: server, keyHint: null } : null);

  function edit(p: AiProvider) {
    setProvider(p);
    formRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  return (
    <div className="grid gap-5">
      <p className="text-[13px] leading-relaxed text-haze">
        La IA lee tus tickets y, con Gemini u OpenAI, también tus notas de voz en Telegram. Puedes usar tu propia cuenta: tu API key se guarda
        cifrada, nunca se muestra completa y solo se envía la foto o el audio, nunca tus datos.
      </p>

      <p className="text-[14px]">
        {inUse ? (
          <>
            La IA usa <span className="font-medium">{AI_LABELS[inUse.provider]}</span>{" "}
            <span className="text-mist">· {primary?.keyHint ? `tu llave •••• ${primary.keyHint}` : serverKeys.includes(inUse.provider) ? "llave del servidor" : "sin llave"}</span>
          </>
        ) : (
          <span className="text-mist">Sin IA: agrega una llave para leer tickets y notas de voz.</span>
        )}
      </p>

      {keys.length ? (
        <ul className="grid gap-2">
          {keys.map((k) => (
            <li key={k.provider} className="rounded-2xl bg-white/[.03] px-4 py-3 ring-1 ring-white/[.06]">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <p className="text-[15px] font-medium">{AI_LABELS[k.provider]}</p>
                {k.isPrimary ? (
                  <span className="rounded-full bg-mint/10 px-2.5 py-0.5 text-[11px] font-medium text-mint ring-1 ring-mint/25">Principal</span>
                ) : null}
                <p className="num w-full text-[12px] text-haze sm:ml-auto sm:w-auto">
                  {k.keyHint ? `•••• ${k.keyHint}` : "Llave del servidor"} · {k.model || AI_DEFAULT_MODELS[k.provider]}
                </p>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                {!k.isPrimary ? (
                  <ActionButton action={setPrimaryAiAction} fields={{ provider: k.provider }} variant="primary" pending="Cambiando…">
                    Usar como principal
                  </ActionButton>
                ) : null}
                {k.keyHint ? (
                  <ActionForm action={testAiSettingAction} okMessage="La llave funciona." className="contents">
                    <input type="hidden" name="provider" value={k.provider} />
                    <SubmitButton variant="ghost" pending="Probando…" className="!rounded-full !px-4 !py-2 !text-[13px]">
                      Probar
                    </SubmitButton>
                  </ActionForm>
                ) : null}
                <button type="button" onClick={() => edit(k.provider)} className="btn btn-ghost rounded-full px-4 py-2 text-[13px]">
                  Editar
                </button>
                <ActionButton action={deleteAiSettingAction} fields={{ provider: k.provider }} variant="danger" pending="Borrando…">
                  Eliminar
                </ActionButton>
              </div>
            </li>
          ))}
        </ul>
      ) : null}

      <div ref={formRef} className="border-t border-white/[.06] pt-5">
        <h3 className="text-[15px] font-medium">{current ? `Editar ${AI_LABELS[provider]}` : "Agregar llave"}</h3>
        <ActionForm action={saveAiSettingAction} resetOnOk={false} okMessage="Guardado." className="mt-4 grid gap-4 sm:grid-cols-2 sm:items-end">
          <div>
            <label htmlFor="ai-provider" className="block text-[12px] text-haze">
              Proveedor
            </label>
            <select id="ai-provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)} className="field mt-1.5">
              {(Object.keys(AI_LABELS) as AiProvider[]).map((p) => (
                <option key={p} value={p}>
                  {AI_LABELS[p]}
                  {keys.some((k) => k.provider === p) ? " (guardada)" : ""}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="ai-model" className="block text-[12px] text-haze">
              Modelo (opcional)
            </label>
            <input
              id="ai-model"
              name="model"
              key={provider}
              defaultValue={current?.model ?? ""}
              placeholder={AI_DEFAULT_MODELS[provider]}
              autoComplete="off"
              spellCheck={false}
              className="field mt-1.5"
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ai-key" className="block text-[12px] text-haze">
              API key {hasOwnKey ? <span className="num text-mist">· guardada •••• {current!.keyHint}</span> : null}
            </label>
            <input
              id="ai-key"
              name="apiKey"
              type="password"
              key={`k-${provider}`}
              placeholder={hasOwnKey ? "Déjala vacía para conservar la actual" : "Pega tu API key"}
              autoComplete="off"
              spellCheck={false}
              className="field mt-1.5"
            />
            <p className="mt-1.5 text-[12px] text-haze">
              Consíguela en{" "}
              <a href={KEY_URL[provider]} target="_blank" rel="noreferrer" className="text-[#8fa8ff] underline-offset-2 hover:underline">
                {new URL(KEY_URL[provider]).host}
              </a>
              . El uso se cobra en tu cuenta del proveedor.
            </p>
          </div>

          <div className="flex flex-wrap gap-2 text-[12px] sm:col-span-2">
            <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-mist">🧾 Fotos de tickets</span>
            <span className={`rounded-full border px-3 py-1 ${supportsVoice(provider) ? "border-white/10 bg-white/5 text-mist" : "border-white/[.06] text-haze line-through"}`}>
              🎙️ Notas de voz
            </span>
            <span className="rounded-full px-3 py-1 text-haze">
              {effective ? `Con ${AI_LABELS[provider]} usará ${effective}.` : "Sin llave: la IA no funcionará con este proveedor."}
            </span>
          </div>

          <div className="sm:col-span-2">
            <SubmitButton pending="Validando…">{current ? "Guardar cambios" : "Agregar llave"}</SubmitButton>
          </div>
        </ActionForm>
      </div>
    </div>
  );
}
