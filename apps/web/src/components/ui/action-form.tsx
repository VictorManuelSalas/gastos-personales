"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/actions/util";
import { useDisclosure } from "./disclosure";

type Props = {
  action: (prev: ActionState, form: FormData) => Promise<ActionState>;
  children: ReactNode;
  className?: string;
  /** Limpia el formulario al guardar con éxito. */
  resetOnOk?: boolean;
  /** Cierra el panel Disclosure que lo contiene al guardar. */
  closeOnOk?: boolean;
  okMessage?: string;
};

/** Formulario con acción de servidor, error animado y confirmación breve. */
export function ActionForm({ action, children, className = "", resetOnOk = true, closeOnOk = false, okMessage }: Props) {
  const [state, formAction] = useActionState(action, { error: null });
  const { close } = useDisclosure();
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!state.ok) return;
    if (resetOnOk) ref.current?.reset();
    if (closeOnOk) close();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.at]);

  return (
    <form ref={ref} action={formAction} className={className} noValidate>
      {children}
      <AnimatePresence initial={false}>
        {state.error ? (
          <motion.p
            key={`e${state.at}`}
            role="alert"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            className="col-span-full overflow-hidden text-[13px] text-rose"
          >
            {state.error}
          </motion.p>
        ) : state.ok && okMessage ? (
          <motion.p
            key={`o${state.at}`}
            role="status"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="col-span-full text-[13px] text-mint"
          >
            {okMessage}
          </motion.p>
        ) : null}
      </AnimatePresence>
    </form>
  );
}

export function SubmitButton({
  children,
  pending = "Guardando…",
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  pending?: string;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
}) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" disabled={isPending} className={`btn btn-${variant} rounded-xl px-5 py-3 text-[14px] ${className}`}>
      {isPending ? pending : children}
    </button>
  );
}

/** Botón de una sola acción (sin estado), p. ej. archivar o deshacer. */
export function ActionButton({
  action,
  fields,
  children,
  variant = "ghost",
  className = "",
  pending,
}: {
  action: (f: FormData) => Promise<void>;
  fields: Record<string, string>;
  children: ReactNode;
  variant?: "primary" | "ghost" | "danger";
  className?: string;
  pending?: string;
}) {
  return (
    <form action={action} className="contents">
      {Object.entries(fields).map(([k, v]) => (
        <input key={k} type="hidden" name={k} value={v} />
      ))}
      <SubmitButton variant={variant} pending={pending ?? "…"} className={`!rounded-full !px-4 !py-2 !text-[13px] ${className}`}>
        {children}
      </SubmitButton>
    </form>
  );
}
