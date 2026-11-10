"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import { ActionForm, SubmitButton } from "@/components/ui/action-form";
import { splitTxnAction } from "@/server/actions/money";

type Opt = { id: string; label: string };

/** Divide un gasto en varias categorías (RF-14). */
export function SplitForm({ txnId, amountLabel, categories, current }: { txnId: string; amountLabel: string; categories: Opt[]; current: { categoryId: string | null; amount: string }[] }) {
  const [open, setOpen] = useState(false);
  const rows = current.length >= 2 ? [...current, { categoryId: null, amount: "" }] : [{ categoryId: null, amount: "" }, { categoryId: null, amount: "" }, { categoryId: null, amount: "" }];
  return (
    <div className="w-full">
      <button type="button" onClick={() => setOpen((o) => !o)} className="text-[12px] text-haze underline-offset-4 hover:text-ink hover:underline">
        {current.length ? `Dividido en ${current.length}` : "Dividir"}
      </button>
      <AnimatePresence initial={false}>
        {open ? (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
            <ActionForm action={splitTxnAction} resetOnOk={false} okMessage="Guardado" className="mt-3 grid gap-2">
              <input type="hidden" name="id" value={txnId} />
              <p className="text-[12px] text-haze">Las partes deben sumar {amountLabel}. Deja todo vacío para quitar la división.</p>
              {rows.map((r, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px] gap-2">
                  <select name="splitCategory" defaultValue={r.categoryId ?? ""} aria-label={`Categoría de la parte ${i + 1}`} className="field !py-2 sm:text-[13px]">
                    <option value="">Sin categoría</option>
                    {categories.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <input name="splitAmount" inputMode="decimal" defaultValue={r.amount} placeholder="0.00" aria-label={`Monto de la parte ${i + 1}`} className="field num !py-2 sm:text-[13px]" />
                </div>
              ))}
              <div>
                <SubmitButton variant="ghost" className="!py-2 !text-[13px]">
                  Guardar división
                </SubmitButton>
              </div>
            </ActionForm>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
