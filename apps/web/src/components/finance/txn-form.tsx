"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { createTxnAction } from "@/server/actions/money";

type Opt = { id: string; label: string };

export function TxnForm({
  categories,
  accounts,
  lines,
  today,
  defaultSource,
}: {
  categories: { expense: Opt[]; income: Opt[] };
  accounts: Opt[];
  lines: Opt[];
  today: string;
  defaultSource: string;
}) {
  const [kind, setKind] = useState<"expense" | "income">("expense");
  const cats = categories[kind];

  return (
    <ActionForm action={createTxnAction} okMessage="Registrado" className="grid gap-4 sm:grid-cols-2">
      <input type="hidden" name="kind" value={kind} />
      <div className="grid grid-cols-2 rounded-full bg-white/[.05] p-1 text-[13px] ring-1 ring-white/10 sm:col-span-2" role="radiogroup" aria-label="Tipo de movimiento">
        {(["expense", "income"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="radio"
            aria-checked={kind === k}
            onClick={() => setKind(k)}
            className={`btn rounded-full py-2 ${kind === k ? "bg-white/[.12] text-ink ring-1 ring-white/15" : "text-haze"}`}
          >
            {k === "expense" ? "Gasto" : "Ingreso"}
          </button>
        ))}
      </div>

      <div>
        <label htmlFor="tx-amount" className="block text-[12px] text-haze">
          Monto
        </label>
        <input id="tx-amount" name="amount" inputMode="decimal" placeholder="65" className="field num mt-1.5 text-[20px]" autoComplete="off" />
      </div>
      <div>
        <label htmlFor="tx-cat" className="block text-[12px] text-haze">
          Categoría
        </label>
        <select id="tx-cat" name="categoryId" key={kind} className="field mt-1.5" defaultValue="">
          <option value="">Sin categoría</option>
          {cats.map((c) => (
            <option key={c.id} value={c.id}>
              {c.label}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="tx-src" className="block text-[12px] text-haze">
          {kind === "expense" ? "Pagado con" : "Entró a"}
        </label>
        <select id="tx-src" name="source" key={`s-${kind}`} defaultValue={kind === "income" ? `a:${accounts[0]?.id ?? ""}` : defaultSource} className="field mt-1.5">
          {accounts.length ? (
            <optgroup label="Cuentas">
              {accounts.map((a) => (
                <option key={a.id} value={`a:${a.id}`}>
                  {a.label}
                </option>
              ))}
            </optgroup>
          ) : null}
          {kind === "expense" && lines.length ? (
            <optgroup label="Tarjetas de crédito">
              {lines.map((l) => (
                <option key={l.id} value={`c:${l.id}`}>
                  {l.label}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>
      </div>
      <div>
        <label htmlFor="tx-date" className="block text-[12px] text-haze">
          Fecha
        </label>
        <input id="tx-date" name="date" type="date" defaultValue={today} max={today} className="field mt-1.5" />
      </div>
      <div className="sm:col-span-2">
        <label htmlFor="tx-merchant" className="block text-[12px] text-haze">
          Dónde o nota (opcional)
        </label>
        <input id="tx-merchant" name="merchant" placeholder="OXXO, Starbucks, súper…" className="field mt-1.5" />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton className="w-full sm:w-auto">Registrar</SubmitButton>
      </div>
    </ActionForm>
  );
}
