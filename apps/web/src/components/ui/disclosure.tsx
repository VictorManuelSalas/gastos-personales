"use client";

import { AnimatePresence, motion } from "motion/react";
import { createContext, useContext, useState, type ReactNode } from "react";

const Ctx = createContext<{ close: () => void }>({ close: () => {} });

/** Para que un formulario dentro del panel lo cierre al guardar. */
export const useDisclosure = () => useContext(Ctx);

type Props = {
  label: ReactNode;
  children: ReactNode;
  defaultOpen?: boolean;
  variant?: "primary" | "ghost";
  className?: string;
  buttonClassName?: string;
};

/** Botón que despliega un panel con animación suave (formularios de "Agregar"). */
export function Disclosure({ label, children, defaultOpen = false, variant = "ghost", className = "", buttonClassName = "" }: Props) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Ctx.Provider value={{ close: () => setOpen(false) }}>
      <div className={className}>
        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          className={`btn btn-${variant} rounded-full px-5 py-2.5 text-[14px] ${buttonClassName}`}
        >
          <motion.span animate={{ rotate: open ? 45 : 0 }} transition={{ type: "spring", stiffness: 500, damping: 30 }} className="inline-block text-[18px] leading-none">
            +
          </motion.span>
          {label}
        </button>
        <AnimatePresence initial={false}>
          {open ? (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="overflow-hidden"
            >
              <div className="pt-4">{children}</div>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </Ctx.Provider>
  );
}

