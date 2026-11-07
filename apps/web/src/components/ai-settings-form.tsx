"use client";

import { AI_DEFAULT_MODELS, AI_LABELS, supportsVoice, type AiProvider } from "@gp/core";
import { useState } from "react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { deleteAiSettingAction, saveAiSettingAction, testAiSettingAction } from "@/server/actions/ai";

const KEY_URL: Record<AiProvider, string> = {
  gemini: "https://aistudio.google.com/apikey",
  openai: "https://platform.openai.com/api-keys",
  anthropic: "https://console.anthropic.com/settings/keys",
};

type Props = {
  current: { provider: AiProvider; model: string | null; keyHint: string | null } | null;
  /** Proveedor que da el servidor cuando el usuario no tiene llave propia. */
  server: AiProvider | null;
  /** Proveedores para los que el servidor tiene llave. */
  serverKeys: AiProvider[];
};

export function AiSettingsForm({ current, server, serverKeys }: Props) {
  const [provider, setProvider] = useState<AiProvider>(current?.provider ?? server ?? "gemini");
  const sameProvider = current?.provider === provider;
  const hasOwnKey = sameProvider && !!current?.keyHint;
  const effective = hasOwnKey ? "tu llave" : serverKeys.includes(provider) ? "la llave del servidor" : null;

  return (
    <div className="grid gap-5">
      <p className="text-[13px] leading-relaxed text-haze">
        La IA lee tus tickets y, con Gemini u OpenAI, también tus notas de voz en Telegram. Puedes usar tu propia cuenta: tu API key se guarda
        cifrada, nunca se muestra completa y solo se envía la foto o el audio, nunca tus datos.
      </p>

      <ActionForm action={saveAiSettingAction} resetOnOk={false} okMessage="Guardado." className="grid gap-4 sm:grid-cols-2 sm:items-end">
        <div>
          <label htmlFor="ai-provider" className="block text-[12px] text-haze">
            Proveedor
          </label>
          <select id="ai-provider" name="provider" value={provider} onChange={(e) => setProvider(e.target.value as AiProvider)} className="field mt-1.5">
            {(Object.keys(AI_LABELS) as AiProvider[]).map((p) => (
              <option key={p} value={p}>
                {AI_LABELS[p]}
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
            defaultValue={sameProvider ? (current?.model ?? "") : ""}
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
            {effective ? `Usará ${effective}.` : "Sin llave: la IA no funcionará con este proveedor."}
          </span>
        </div>

        <div className="sm:col-span-2">
          <SubmitButton pending="Validando…">Guardar IA</SubmitButton>
        </div>
      </ActionForm>

      {current?.keyHint ? (
        <div className="flex flex-wrap items-center gap-3 border-t border-white/[.06] pt-5">
          <ActionForm action={testAiSettingAction} okMessage="Tu llave funciona." className="contents">
            <SubmitButton variant="ghost" pending="Probando…" className="!rounded-full !px-4 !py-2 !text-[13px]">
              Probar llave •••• {current.keyHint}
            </SubmitButton>
          </ActionForm>
          <ActionButton action={deleteAiSettingAction} fields={{}} variant="danger" pending="Borrando…">
            Borrar mi llave
          </ActionButton>
        </div>
      ) : null}
    </div>
  );
}
