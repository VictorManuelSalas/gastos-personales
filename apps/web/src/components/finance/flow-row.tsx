"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { payCycleAction } from "@/server/actions/cards";
import { contributeGoalAction } from "@/server/actions/goals";
import { confirmIncomeAction } from "@/server/actions/money";

export type RowAccount = { id: string; name: string; isDefault: boolean };

export type RowItem = {
  id: string;
  kind: "income" | "card" | "loan" | "goal";
  label: string;
  dateLabel: string;
  amountLabel: string;
  amountInput: string;
  direction: "in" | "out";
  status: "pending" | "done";
  estimated?: boolean;
  overdue?: boolean;
  /** Ingreso cuyo día de cobro ya llegó (se puede confirmar). */
  confirmable?: boolean;
  color?: string;
  ref?: Record<string, string>;
};

const ease = [0.16, 1, 0.3, 1] as const;

export function FlowRow({ item, accounts, today }: { item: RowItem; accounts: RowAccount[]; today: string }) {
  const [open, setOpen] = useState(false);
  const isGoal = item.kind === "goal";
  const canAct = item.status === "pending" && (item.direction === "out" || item.confirmable);
  const defaultAccount = item.ref?.accountId || accounts.find((a) => a.isDefault)?.id || accounts[0]?.id || "";

  return (
    <li className="rounded-2xl bg-white/[.03] ring-1 ring-white/[.06] transition-colors duration-300 hover:bg-white/[.05]">
      <div className="flex items-center gap-3 px-4 py-3">
        <span
          className="h-2.5 w-2.5 shrink-0 rounded-full"
          style={{ background: item.direction === "in" ? "var(--color-mint)" : (item.color ?? "var(--color-glow)") }}
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <p className={`truncate text-[14px] ${item.status === "done" ? "text-mist line-through decoration-white/20" : ""}`}>{item.label}</p>
          <p className="mt-0.5 text-[12px] text-haze">
            {item.dateLabel}
            {item.overdue ? <span className="ml-2 text-rose">Vencido</span> : null}
            {item.status === "done" ? (
              <span className="ml-2 text-mint">{item.direction === "in" ? "Cobrado" : isGoal ? "Apartado" : "Pagado"}</span>
            ) : item.estimated ? (
              <span className="ml-2">estimado</span>
            ) : null}
          </p>
        </div>
        <span className={`num shrink-0 text-[15px] ${item.direction === "in" ? "text-mint" : ""} ${item.status === "done" ? "opacity-60" : ""}`}>
          {item.direction === "in" ? "+" : "−"}
          {item.amountLabel}
        </span>
        {canAct ? (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="btn btn-ghost shrink-0 rounded-full px-3 py-1.5 text-[12px]"
          >
            {open ? "Cerrar" : item.direction === "in" ? "Confirmar" : isGoal ? "Apartar" : "Pagar"}
          </button>
        ) : null}
      </div>

      <AnimatePresence initial={false}>
        {open && canAct ? (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.45, ease }}
            className="overflow-hidden"
          >
            <ActionForm
              action={item.direction === "in" ? confirmIncomeAction : isGoal ? contributeGoalAction : payCycleAction}
              className="grid gap-3 border-t border-white/[.06] px-4 pb-4 pt-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
            >
              {isGoal ? (
                <>
                  <input type="hidden" name="goalId" value={item.ref?.goalId} />
                  <input type="hidden" name="period" value={item.ref?.period} />
                </>
              ) : item.direction === "in" ? (
                <>
                  <input type="hidden" name="sourceId" value={item.ref?.sourceId} />
                  <input type="hidden" name="period" value={item.ref?.period} />
                </>
              ) : (
                <>
                  <input type="hidden" name="lineId" value={item.ref?.lineId} />
                  <input type="hidden" name="cut" value={item.ref?.cut} />
                  <input type="hidden" name="paidAt" value={today} />
                </>
              )}
              <div>
                <label htmlFor={`amt-${item.id}`} className="block text-[12px] text-haze">
                  {item.direction === "in" ? "¿Cuánto te cayó?" : isGoal ? "¿Cuánto apartas?" : "¿Cuánto pagaste?"}
                </label>
                <input id={`amt-${item.id}`} name="amount" inputMode="decimal" defaultValue={item.amountInput} className="field num mt-1.5" />
              </div>
              {isGoal ? <p className="self-center text-[12px] text-haze">Se queda en tu cuenta, separado del disponible.</p> : <div>
                <label htmlFor={`acc-${item.id}`} className="block text-[12px] text-haze">
                  {item.direction === "in" ? "Entró a" : "Salió de"}
                </label>
                <select id={`acc-${item.id}`} name="accountId" defaultValue={defaultAccount} className="field mt-1.5">
                  {item.direction === "out" ? <option value="">Sin cuenta (no mover saldo)</option> : null}
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name}
                    </option>
                  ))}
                </select>
              </div>}
              <SubmitButton>{item.direction === "in" ? "Confirmar" : isGoal ? "Apartar" : "Marcar pagado"}</SubmitButton>
            </ActionForm>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
