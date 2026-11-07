"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { createInvitationAction, type InviteState } from "./actions";

function Submit() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="btn btn-primary w-full rounded-xl py-3 text-[14px] sm:w-auto sm:px-6">
      {pending ? "Generando…" : "Generar invitación"}
    </button>
  );
}

export function InviteForm() {
  const [state, action] = useActionState<InviteState, FormData>(createInvitationAction, { error: null });
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="grid gap-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end" noValidate>
      <div>
        <label htmlFor="inv-email" className="block text-[12px] text-haze">
          Correo (opcional)
        </label>
        <input id="inv-email" name="email" type="email" placeholder="Solo esta persona podrá usarla" className="field mt-2" />
      </div>
      <div>
        <label htmlFor="inv-note" className="block text-[12px] text-haze">
          Nota (opcional)
        </label>
        <input id="inv-note" name="note" type="text" maxLength={120} placeholder="Para mamá" className="field mt-2" />
      </div>
      <Submit />
      <AnimatePresence initial={false}>
        {state.error ? (
          <motion.p
            key={state.error}
            role="alert"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="text-[13px] text-rose sm:col-span-3"
          >
            {state.error}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}
