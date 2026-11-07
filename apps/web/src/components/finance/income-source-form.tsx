"use client";

import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { createIncomeSourceAction } from "@/server/actions/money";

export function IncomeSourceForm({ accounts }: { accounts: { id: string; label: string }[] }) {
  const [schedule, setSchedule] = useState<"paydays" | "monthly">("paydays");
  return (
    <ActionForm action={createIncomeSourceAction} closeOnOk className="grid gap-4 sm:grid-cols-2">
      <div>
        <label htmlFor="in-name" className="block text-[12px] text-haze">
          Nombre
        </label>
        <input id="in-name" name="name" placeholder="Sueldo 1" className="field mt-1.5" />
      </div>
      <div>
        <label htmlFor="in-exp" className="block text-[12px] text-haze">
          Monto esperado
        </label>
        <input id="in-exp" name="expected" inputMode="decimal" placeholder="7360" className="field num mt-1.5" />
      </div>
      <div>
        <label htmlFor="in-sch" className="block text-[12px] text-haze">
          ¿Cuándo cae?
        </label>
        <select id="in-sch" name="schedule" value={schedule} onChange={(e) => setSchedule(e.target.value as "paydays" | "monthly")} className="field mt-1.5">
          <option value="paydays">Cada quincena (15 y último del mes)</option>
          <option value="monthly">Un día fijo al mes</option>
        </select>
      </div>
      {schedule === "monthly" ? (
        <div>
          <label htmlFor="in-day" className="block text-[12px] text-haze">
            Día del mes
          </label>
          <input id="in-day" name="monthlyDay" type="number" min={1} max={31} placeholder="5" className="field num mt-1.5" />
        </div>
      ) : (
        <div>
          <label htmlFor="in-est" className="block text-[12px] text-haze">
            Para proyectar, usar
          </label>
          <select id="in-est" name="estimation" defaultValue="fixed" className="field mt-1.5">
            <option value="fixed">El monto esperado</option>
            <option value="avg3">El promedio de mis últimos 3 cobros</option>
          </select>
        </div>
      )}
      <div className="sm:col-span-2">
        <label htmlFor="in-acc" className="block text-[12px] text-haze">
          Cae en la cuenta
        </label>
        <select id="in-acc" name="accountId" defaultValue={accounts[0]?.id ?? ""} className="field mt-1.5">
          <option value="">La principal</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.label}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <SubmitButton>Agregar</SubmitButton>
      </div>
    </ActionForm>
  );
}
