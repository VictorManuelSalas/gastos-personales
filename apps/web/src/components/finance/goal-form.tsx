"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { createGoalAction } from "@/server/actions/goals";

export function GoalForm({
  accounts,
  avgEssentialLabel,
  hasEmergency,
}: {
  accounts: { id: string; label: string }[];
  avgEssentialLabel: string | null;
  hasEmergency: boolean;
}) {
  const [kind, setKind] = useState<"goal" | "emergency" | "sinking">(hasEmergency ? "goal" : "emergency");
  const emergency = kind === "emergency";
  const sinking = kind === "sinking";

  return (
    <ActionForm action={createGoalAction} className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-3 rounded-full bg-white/[.05] p-1 text-[12px] ring-1 ring-white/10 sm:col-span-2 sm:text-[13px]" role="radiogroup" aria-label="Tipo de meta">
        {(hasEmergency ? (["goal", "sinking"] as const) : (["emergency", "goal", "sinking"] as const)).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`btn rounded-full py-2 ${kind === k ? "bg-white/[.12] text-ink ring-1 ring-white/15" : "text-haze"}`}
          >
            {k === "emergency" ? "Emergencia" : k === "sinking" ? "Gasto anual" : "Meta"}
          </button>
        ))}
      </div>

      {sinking ? (
        <p className="text-[13px] leading-relaxed text-mist sm:col-span-2">
          Para gastos que llegan cada año: diciembre, seguro o tenencia del carro, inscripciones. Aparta un poco cada quincena y, cuando llegue la
          fecha, el dinero ya está. La fecha avanza sola al año siguiente.
        </p>
      ) : null}
      {emergency ? (
        <p className="text-[13px] leading-relaxed text-mist sm:col-span-2">
          Es lo primero que conviene juntar: te protege de endeudarte cuando falla el carro o hay un gasto médico.{" "}
          {avgEssentialLabel
            ? `Tus gastos esenciales promedian ${avgEssentialLabel} al mes; el objetivo se calcula solo.`
            : "Cuando registres gastos esenciales, el objetivo se calculará solo. Mientras, puedes fijarlo tú."}
        </p>
      ) : null}

      <div className="grid grid-cols-[72px_1fr] gap-3 sm:col-span-2">
        <div>
          <label htmlFor="gl-emoji" className="block text-[12px] text-haze">
            Emoji
          </label>
          <input id="gl-emoji" name="emoji" maxLength={4} placeholder={emergency ? "🛟" : sinking ? "🎄" : "✈️"} className="field mt-1.5 text-center" />
        </div>
        <div>
          <label htmlFor="gl-name" className="block text-[12px] text-haze">
            Nombre
          </label>
          <input id="gl-name" name="name" placeholder={emergency ? "Fondo de emergencia" : sinking ? "Diciembre" : "Viaje a Japón"} className="field mt-1.5" />
        </div>
      </div>

      {emergency ? (
        <div>
          <label htmlFor="gl-months" className="block text-[12px] text-haze">
            ¿Cuántos meses de gastos?
          </label>
          <select id="gl-months" name="months" defaultValue="3" className="field mt-1.5">
            <option value="1">1 mes (primer escalón)</option>
            <option value="3">3 meses</option>
            <option value="6">6 meses</option>
          </select>
        </div>
      ) : null}

      <div>
        <label htmlFor="gl-target" className="block text-[12px] text-haze">
          {emergency ? "Objetivo (opcional, si no se calcula)" : sinking ? "¿Cuánto cuesta cada año?" : "¿Cuánto quieres juntar?"}
        </label>
        <input id="gl-target" name="target" inputMode="decimal" placeholder={emergency ? "" : "40000"} className="field num mt-1.5" />
      </div>
      <div>
        <label htmlFor="gl-date" className="block text-[12px] text-haze">
          {sinking ? "¿Cuándo llega el gasto?" : "¿Para cuándo? (opcional)"}
        </label>
        <input id="gl-date" name="targetDate" type="date" className="field mt-1.5" />
      </div>
      <div>
        <label htmlFor="gl-auto" className="block text-[12px] text-haze">
          Apartar automáticamente cada cobro (opcional)
        </label>
        <input id="gl-auto" name="auto" inputMode="decimal" placeholder="1000" className="field num mt-1.5" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="gl-acc" className="block text-[12px] text-haze">
          ¿Dónde vive el dinero?
        </label>
        <select id="gl-acc" name="accountId" defaultValue="" className="field mt-1.5">
          <option value="">Apartado virtual en mi cuenta de siempre</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              En mi cuenta {a.label}
            </option>
          ))}
        </select>
        <p className="mt-1.5 text-[12px] text-haze">
          Con apartado virtual el dinero no se mueve, pero deja de contar como disponible en tu quincena.
        </p>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Crear meta</SubmitButton>
      </div>
    </ActionForm>
  );
}
