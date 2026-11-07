"use client";

import { AnimatePresence, motion } from "motion/react";
import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import { GlassCard } from "@/components/ui/glass-card";
import type { FormState } from "@/app/(auth)/actions";

type Field = {
  name: string;
  label: string;
  type: "text" | "email" | "password";
  autoComplete: string;
  placeholder?: string;
  defaultValue?: string;
  readOnly?: boolean;
  hint?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  fields: Field[];
  submitLabel: string;
  pendingLabel: string;
  action: (prev: FormState, form: FormData) => Promise<FormState>;
  hidden?: Record<string, string>;
  footer?: ReactNode;
};

const ease = [0.16, 1, 0.3, 1] as const;

function Submit({ label, pending }: { label: string; pending: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" disabled={isPending} className="btn btn-primary mt-7 w-full rounded-xl py-3.5 text-[15px]">
      {isPending ? (
        <>
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-[#0d0e15]/30 border-t-[#0d0e15]" />
          {pending}
        </>
      ) : (
        label
      )}
    </button>
  );
}

export function AuthForm({ title, subtitle, fields, submitLabel, pendingLabel, action, hidden, footer }: Props) {
  const [state, formAction] = useActionState(action, { error: null });

  return (
    <motion.div
      initial={{ y: 28, filter: "blur(8px)" }}
      animate={{ y: 0, filter: "blur(0px)" }}
      transition={{ duration: 1, ease, delay: 0.12 }}
    >
      <GlassCard interactive={false} className="p-7 md:p-9">
        <form action={formAction} noValidate>
          <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
          {subtitle ? <p className="mt-1.5 text-[14px] text-mist">{subtitle}</p> : null}

          {hidden
            ? Object.entries(hidden).map(([k, v]) => <input key={k} type="hidden" name={k} value={v} />)
            : null}

          <div className="mt-6 grid gap-4">
            {fields.map((f) => (
              <div key={f.name}>
                <label htmlFor={f.name} className="block text-[12px] text-haze">
                  {f.label}
                </label>
                <input
                  id={f.name}
                  name={f.name}
                  type={f.type}
                  autoComplete={f.autoComplete}
                  placeholder={f.placeholder}
                  defaultValue={state.values?.[f.name] ?? f.defaultValue}
                  readOnly={f.readOnly}
                  className="field mt-2"
                />
                {f.hint ? <p className="mt-1.5 text-[12px] text-haze">{f.hint}</p> : null}
              </div>
            ))}
          </div>

          <AnimatePresence initial={false}>
            {state.error ? (
              <motion.p
                key={state.error}
                role="alert"
                initial={{ opacity: 0, height: 0, marginTop: 0 }}
                animate={{ opacity: 1, height: "auto", marginTop: 20 }}
                exit={{ opacity: 0, height: 0, marginTop: 0 }}
                transition={{ duration: 0.45, ease }}
                className="overflow-hidden rounded-xl bg-rose/10 px-4 py-3 text-[13px] text-rose ring-1 ring-rose/25"
              >
                {state.error}
              </motion.p>
            ) : null}
          </AnimatePresence>

          <Submit label={submitLabel} pending={pendingLabel} />
          {footer ? <div className="mt-5 text-center text-[13px] text-haze">{footer}</div> : null}
        </form>
      </GlassCard>
    </motion.div>
  );
}
