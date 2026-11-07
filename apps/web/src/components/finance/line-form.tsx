"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import type { ActionState } from "@/server/actions/util";

const COLORS = ["#8fa8ff", "#6fe3b5", "#f3c46b", "#ff8a8a", "#c49bff", "#5fd0f3", "#f39bd0", "#c9ccd8"];

export type LineDefaults = {
  id?: string;
  kind: "card" | "loan";
  name: string;
  color: string;
  cutDay: number | "";
  dueKind: "days_after" | "fixed_day";
  dueValue: number | "";
  policy: "none" | "previous" | "next";
  creditLimit: string;
  fixedPayment: string;
  remainingPayments: number | "";
};

export const EMPTY_LINE: LineDefaults = {
  kind: "card",
  name: "",
  color: COLORS[0]!,
  cutDay: "",
  dueKind: "days_after",
  dueValue: 20,
  policy: "none",
  creditLimit: "",
  fixedPayment: "",
  remainingPayments: "",
};

export function LineForm({
  action,
  defaults = EMPTY_LINE,
  submitLabel,
  allowKind = true,
}: {
  action: (p: ActionState, f: FormData) => Promise<ActionState>;
  defaults?: LineDefaults;
  submitLabel: string;
  allowKind?: boolean;
}) {
  const [kind, setKind] = useState(defaults.kind);
  const [dueKind, setDueKind] = useState(defaults.dueKind);
  const loan = kind === "loan";

  return (
    <ActionForm action={action} resetOnOk={false} closeOnOk okMessage={defaults.id ? "Guardado" : undefined} className="grid gap-4 sm:grid-cols-2">
      {defaults.id ? <input type="hidden" name="id" value={defaults.id} /> : null}
      <input type="hidden" name="kind" value={kind} />

      {allowKind ? (
        <div className="relative grid grid-cols-2 rounded-full bg-white/[.05] p-1 text-[13px] ring-1 ring-white/10 sm:col-span-2" role="radiogroup" aria-label="Tipo">
          {(["card", "loan"] as const).map((k) => (
            <button
              key={k}
              type="button"
              role="radio"
              aria-checked={kind === k}
              onClick={() => setKind(k)}
              className={`btn rounded-full py-2 ${kind === k ? "bg-white/[.12] text-ink ring-1 ring-white/15" : "text-haze"}`}
            >
              {k === "card" ? "Tarjeta de crédito" : "Préstamo"}
            </button>
          ))}
        </div>
      ) : null}

      <div className="sm:col-span-2">
        <label htmlFor="ln-name" className="block text-[12px] text-haze">
          Nombre
        </label>
        <input id="ln-name" name="name" defaultValue={defaults.name} placeholder={loan ? "Carro KIA" : "BBVA Azul"} className="field mt-1.5" />
      </div>

      <div>
        <label htmlFor="ln-cut" className="block text-[12px] text-haze">
          {loan ? "Día de pago" : "Día de corte"}
        </label>
        <input id="ln-cut" name="cutDay" type="number" min={1} max={31} defaultValue={defaults.cutDay} placeholder="10" className="field num mt-1.5" />
      </div>

      {loan ? (
        <>
          <input type="hidden" name="dueKind" value="days_after" />
          <input type="hidden" name="dueValue" value="0" />
          <div>
            <label htmlFor="ln-fixed" className="block text-[12px] text-haze">
              Mensualidad
            </label>
            <input id="ln-fixed" name="fixedPayment" inputMode="decimal" defaultValue={defaults.fixedPayment} placeholder="7500" className="field num mt-1.5" />
          </div>
          <div>
            <label htmlFor="ln-rem" className="block text-[12px] text-haze">
              Mensualidades restantes (opcional)
            </label>
            <input id="ln-rem" name="remainingPayments" type="number" min={0} defaultValue={defaults.remainingPayments} className="field num mt-1.5" />
          </div>
        </>
      ) : (
        <>
          <div>
            <label htmlFor="ln-duekind" className="block text-[12px] text-haze">
              Fecha límite
            </label>
            <select
              id="ln-duekind"
              name="dueKind"
              value={dueKind}
              onChange={(e) => setDueKind(e.target.value as LineDefaults["dueKind"])}
              className="field mt-1.5"
            >
              <option value="days_after">Días después del corte</option>
              <option value="fixed_day">Día fijo del mes</option>
            </select>
          </div>
          <div>
            <label htmlFor="ln-due" className="block text-[12px] text-haze">
              {dueKind === "days_after" ? "¿Cuántos días después?" : "¿Qué día del mes?"}
            </label>
            <input id="ln-due" name="dueValue" type="number" min={dueKind === "days_after" ? 0 : 1} max={dueKind === "days_after" ? 60 : 31} defaultValue={defaults.dueValue} className="field num mt-1.5" />
          </div>
          <div>
            <label htmlFor="ln-limit" className="block text-[12px] text-haze">
              Límite de crédito (opcional)
            </label>
            <input id="ln-limit" name="creditLimit" inputMode="decimal" defaultValue={defaults.creditLimit} placeholder="40000" className="field num mt-1.5" />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="ln-policy" className="block text-[12px] text-haze">
              Si la fecha límite cae en fin de semana o día festivo
            </label>
            <select id="ln-policy" name="policy" defaultValue={defaults.policy} className="field mt-1.5">
              <option value="none">Dejarla igual y avisarme</option>
              <option value="previous">Adelantarla al día hábil anterior</option>
              <option value="next">Moverla al siguiente día hábil</option>
            </select>
          </div>
        </>
      )}

      <fieldset className="sm:col-span-2">
        <legend className="text-[12px] text-haze">Color</legend>
        <div className="mt-2 flex flex-wrap gap-2.5">
          {COLORS.map((c) => (
            <label key={c} className="cursor-pointer">
              <input type="radio" name="color" value={c} defaultChecked={c === defaults.color} className="peer sr-only" />
              <span
                className="block h-8 w-8 rounded-full ring-2 ring-transparent ring-offset-2 ring-offset-night transition duration-200 peer-checked:ring-ink peer-focus-visible:ring-glow"
                style={{ background: c }}
              />
              <span className="sr-only">{c}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">{submitLabel}</SubmitButton>
      </div>
    </ActionForm>
  );
}
