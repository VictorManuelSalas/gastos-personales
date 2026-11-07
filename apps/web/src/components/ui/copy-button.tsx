"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";

export function CopyButton({ text, label = "Copiar enlace", done = "Copiado" }: { text: string; label?: string; done?: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      window.prompt("Copia el texto:", text);
    }
  }

  return (
    <button type="button" onClick={copy} className="btn btn-ghost min-w-[118px] rounded-full px-4 py-2 text-[13px]">
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "y" : "n"}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.18 }}
          className={copied ? "text-mint" : undefined}
        >
          {copied ? done : label}
        </motion.span>
      </AnimatePresence>
    </button>
  );
}
