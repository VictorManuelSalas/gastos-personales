"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ActionButton, ActionForm, SubmitButton } from "@/components/ui/action-form";
import { movePaydayAction, payCycleAction, setStatementAction, unpayCycleAction } from "@/server/actions/cards";
import type { RowAccount } from "./flow-row";

export type CycleProps = {
  lineId: string;
  cut: string;
  periodLabel: string;
  dueLabel: string;
  nonBusiness: boolean;
  status: "upcoming" | "open" | "cut" | "paid" | "overdue" | "empty";
  amountLabel: string;
  amountInput: string;
  sourceLabel: string;
  statementInput: string;
  minimumInput: string;
  detailLabel: string | null;
  paydayLabel: string;
  paydayOverride: string | null;
  paydayOptions: { value: string; label: string }[];
  today: string;
  isLoan: boolean;
};

const STATUS: Record<CycleProps["status"], { label: string; cls: string }> = {
  upcoming: { label: "Próximo", cls: "bg-white/5 text-mist ring-white/10" },
  open: { label: "Abierto", cls: "bg-glow/10 text-glow ring-glow/25" },
  cut: { label: "Por pagar", cls: "bg-amber/10 text-amber ring-amber/25" },
  overdue: { label: "Vencido", cls: "bg-rose/10 text-rose ring-rose/25" },
  paid: { label: "Pagado", cls: "bg-mint/10 text-mint ring-mint/25" },
  empty: { label: "Sin saldo", cls: "bg-white/5 text-haze ring-white/10" },
};

type Panel = "statement" | "pay" | "move" | null;
const ease = [0.16, 1, 0.3, 1] as const;

export function CycleCard({ c, accounts }: { c: CycleProps; accounts: RowAccount[] }) {
  const [panel, setPanel] = useState<Panel>(null);
  const toggle = (p: Panel) => setPanel((cur) => (cur === p ? null : p));
  const defaultAccount = accounts.find((a) => a.isDefault)?.id ?? accounts[0]?.id ?? "";

  return (
    <li className="rounded-2xl bg-white/[.03] ring-1 ring-white/[.06]">
      <div className="flex flex-wrap items-start gap-x-4 gap-y-3 p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-[11px] ring-1 ${STATUS[c.status].cls}`}>{STATUS[c.status].label}</span>
            <span className="text-[14px]">{c.periodLabel}</span>
          </div>
          <p className="mt-1.5 text-[12px] text-haze">
            Límite {c.dueLabel}
            {c.nonBusiness ? <span className="ml-1 text-amber" title="Cae en fin de semana o día festivo">· día inhábil</span> : null} · quincena del{" "}
            {c.paydayLabel}
            {c.paydayOverride ? " (movida)" : ""}
          </p>
          {c.detailLabel ? <p className="mt-1 text-[12px] text-haze">{c.detailLabel}</p> : null}
        </div>
        <div className="text-right">
          <p className="num text-[20px] font-semibold tracking-tight">{c.amountLabel}</p>
          <p className="text-[11px] text-haze">{c.sourceLabel}</p>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 px-4 pb-4 sm:px-5">
        {c.status !== "paid" ? (
          <>
            {!c.isLoan ? (
              <button type="button" onClick={() => toggle("statement")} className="btn btn-ghost rounded-full px-3.5 py-1.5 text-[12px]">
                Estado de cuenta
              </button>
            ) : null}
            {c.status === "cut" || c.status === "overdue" || c.isLoan ? (
              <button type="button" onClick={() => toggle("pay")} className="btn btn-ghost rounded-full px-3.5 py-1.5 text-[12px]">
                Marcar pagado
              </button>
            ) : null}
            <button type="button" onClick={() => toggle("move")} className="btn btn-ghost rounded-full px-3.5 py-1.5 text-[12px]">
              Cambiar quincena
            </button>
          </>
        ) : (
          <ActionButton action={unpayCycleAction} fields={{ lineId: c.lineId, cut: c.cut }}>
            Deshacer pago
          </ActionButton>
        )}
      </div>

      <AnimatePresence initial={false} mode="wait">
        {panel ? (
          <motion.div
            key={panel}
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, ease }}
            className="overflow-hidden"
          >
            <div className="border-t border-white/[.06] p-4 sm:p-5">
              {panel === "statement" ? (
                <ActionForm action={setStatementAction} resetOnOk={false} okMessage="Guardado" className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="lineId" value={c.lineId} />
                  <input type="hidden" name="cut" value={c.cut} />
                  <div>
                    <label htmlFor={`st-${c.cut}`} className="block text-[12px] text-haze">
                      Pago para no generar intereses
                    </label>
                    <input id={`st-${c.cut}`} name="statement" inputMode="decimal" defaultValue={c.statementInput} placeholder="Lo que dice tu banco" className="field num mt-1.5" />
                  </div>
                  <div>
                    <label htmlFor={`mn-${c.cut}`} className="block text-[12px] text-haze">
                      Pago mínimo (opcional)
                    </label>
                    <input id={`mn-${c.cut}`} name="minimum" inputMode="decimal" defaultValue={c.minimumInput} className="field num mt-1.5" />
                  </div>
                  <SubmitButton>Guardar</SubmitButton>
                </ActionForm>
              ) : panel === "pay" ? (
                <ActionForm action={payCycleAction} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
                  <input type="hidden" name="lineId" value={c.lineId} />
                  <input type="hidden" name="cut" value={c.cut} />
                  <input type="hidden" name="paidAt" value={c.today} />
                  <div>
                    <label htmlFor={`pa-${c.cut}`} className="block text-[12px] text-haze">
                      ¿Cuánto pagaste?
                    </label>
                    <input id={`pa-${c.cut}`} name="amount" inputMode="decimal" defaultValue={c.amountInput} className="field num mt-1.5" />
                  </div>
                  <div>
                    <label htmlFor={`pac-${c.cut}`} className="block text-[12px] text-haze">
                      Salió de
                    </label>
                    <select id={`pac-${c.cut}`} name="accountId" defaultValue={defaultAccount} className="field mt-1.5">
                      <option value="">Sin cuenta (no mover saldo)</option>
                      {accounts.map((a) => (
                        <option key={a.id} value={a.id}>
                          {a.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton>Marcar pagado</SubmitButton>
                </ActionForm>
              ) : (
                <form action={movePaydayAction} className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
                  <input type="hidden" name="lineId" value={c.lineId} />
                  <input type="hidden" name="cut" value={c.cut} />
                  <div>
                    <label htmlFor={`mv-${c.cut}`} className="block text-[12px] text-haze">
                      Pagar con la quincena del
                    </label>
                    <select id={`mv-${c.cut}`} name="payday" defaultValue={c.paydayOverride ?? ""} className="field mt-1.5">
                      {c.paydayOptions.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <SubmitButton>Mover</SubmitButton>
                </form>
              )}
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </li>
  );
}
