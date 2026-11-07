"use client";

import { AnimatePresence, motion } from "motion/react";
import Link from "next/link";
import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { previewImportAction, runImportAction, type ImportState } from "@/server/actions/import";

const ease = [0.16, 1, 0.3, 1] as const;

function Btn({ children, pending, formAction, variant = "primary" }: { children: string; pending: string; formAction: (f: FormData) => void; variant?: string }) {
  const { pending: isPending } = useFormStatus();
  return (
    <button type="submit" formAction={formAction} disabled={isPending} className={`btn btn-${variant} rounded-xl px-5 py-3 text-[14px]`}>
      {isPending ? pending : children}
    </button>
  );
}

export function ImportWizard() {
  const [preview, previewAction] = useActionState<ImportState, FormData>(previewImportAction, { error: null });
  const [result, importAction] = useActionState<ImportState, FormData>(runImportAction, { error: null });
  const [fileName, setFileName] = useState("");
  // React limpia el formulario tras cada acción; el archivo se conserva aquí.
  const fileRef = useRef<File | null>(null);
  const withFile = (action: (f: FormData) => void) => (f: FormData) => {
    if (fileRef.current) f.set("file", fileRef.current);
    action(f);
  };
  const p = preview.preview;
  const error = (result.at ?? 0) > (preview.at ?? 0) ? result.error : preview.error;

  if (result.done) {
    return (
      <motion.div initial={{ y: 16, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.7, ease }} className="text-center">
        <p className="eyebrow">Listo</p>
        <h2 className="mt-4 text-3xl font-semibold tracking-tight chrome">Tu historial ya está aquí.</h2>
        <p className="num mx-auto mt-4 max-w-md text-[15px] text-mist">
          {result.done.lines} tarjetas y préstamos nuevos, {result.done.cycles} ciclos y {result.done.installments} compras a MSI.
        </p>
        <div className="mt-8 flex flex-wrap justify-center gap-3">
          <Link href="/app" className="btn btn-primary rounded-full px-6 py-3 text-[14px]">
            Ver mi quincena
          </Link>
          <Link href="/app/tarjetas" className="btn btn-ghost rounded-full px-6 py-3 text-[14px]">
            Revisar tarjetas
          </Link>
        </div>
      </motion.div>
    );
  }

  return (
    <form className="grid gap-6" noValidate>
      <label
        htmlFor="imp-file"
        className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-[22px] border border-dashed border-white/15 px-6 py-10 text-center transition-colors duration-300 hover:border-white/30 hover:bg-white/[.03]"
      >
        <span className="text-[15px] font-medium">{fileName || "Elige tu archivo .xlsx"}</span>
        <span className="text-[13px] text-haze">En Google Sheets: Archivo → Descargar → Microsoft Excel (.xlsx)</span>
        <input
          id="imp-file"
          name="file"
          type="file"
          accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
          className="sr-only"
          onChange={(e) => {
            const f = e.target.files?.[0] ?? null;
            fileRef.current = f;
            setFileName(f?.name ?? "");
          }}
        />
      </label>

      <AnimatePresence initial={false}>
        {error ? (
          <motion.p key={error} role="alert" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="text-[14px] text-rose">
            {error}
          </motion.p>
        ) : null}
      </AnimatePresence>

      {!p ? (
        <div>
          <Btn formAction={withFile(previewAction)} pending="Leyendo tu Excel…">
            Revisar archivo
          </Btn>
        </div>
      ) : (
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, ease }} className="grid gap-8">
          <p className="text-[14px] text-mist">
            Encontramos {p.monthSheets} pestañas mensuales. Elige qué importar; puedes cambiar si algo es tarjeta o préstamo.
            {p.skippedSheets.length ? ` Pestañas que se omiten por ahora: ${p.skippedSheets.join(", ")}.` : ""}
          </p>

          <section>
            <h3 className="eyebrow">Tarjetas y préstamos</h3>
            <ul className="mt-3 grid gap-2">
              {p.lines.map((l) => (
                <li key={l.index} className="rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/[.06]">
                  <div className="flex flex-wrap items-center gap-3">
                    <input id={`line_${l.index}`} name={`line_${l.index}`} type="checkbox" defaultChecked className="h-4 w-4 accent-[#8fa8ff]" />
                    <label htmlFor={`line_${l.index}`} className="min-w-0 flex-1 text-[15px] font-medium">
                      {l.name}
                      {l.existing ? <span className="ml-2 text-[12px] font-normal text-haze">ya existe: solo se agrega historial</span> : null}
                    </label>
                    <select name={`kind_${l.index}`} defaultValue={l.kind} aria-label={`Tipo de ${l.name}`} className="field !w-auto !py-1.5 text-[13px]">
                      <option value="card">Tarjeta</option>
                      <option value="loan">Préstamo</option>
                    </select>
                  </div>
                  <p className="mt-2 text-[13px] text-mist">{l.ruleLabel}</p>
                  <p className="num mt-1 text-[12px] text-haze">
                    {l.confidence} · {l.cycles} ciclos · último {l.lastLabel}
                  </p>
                  {l.notes.map((n) => (
                    <p key={n} className="mt-1 text-[12px] text-amber">
                      {n}
                    </p>
                  ))}
                </li>
              ))}
            </ul>
          </section>

          {p.installments.length ? (
            <section>
              <h3 className="eyebrow">Compras a meses sin intereses</h3>
              <ul className="mt-3 grid gap-2">
                {p.installments.map((i) => (
                  <li key={i.index} className="flex flex-wrap items-center gap-3 rounded-2xl bg-white/[.03] p-4 ring-1 ring-white/[.06]">
                    <input
                      id={`msi_${i.index}`}
                      name={`msi_${i.index}`}
                      type="checkbox"
                      defaultChecked={!i.done && Boolean(i.matched)}
                      disabled={i.done || !i.matched}
                      className="h-4 w-4 accent-[#8fa8ff]"
                    />
                    <label htmlFor={`msi_${i.index}`} className="min-w-0 flex-1">
                      <span className="text-[14px]">{i.product}</span>
                      <span className="ml-2 text-[12px] text-haze">{i.matched ?? `${i.bank}: no encontramos esa tarjeta`}</span>
                      <span className="mt-0.5 block text-[12px] text-haze">{i.done ? "Ya terminada, se omite" : i.label}</span>
                    </label>
                  </li>
                ))}
              </ul>
            </section>
          ) : null}

          <div className="flex flex-wrap gap-3">
            <Btn formAction={withFile(importAction)} pending="Importando…">
              Importar
            </Btn>
            <Btn formAction={withFile(previewAction)} pending="Leyendo…" variant="ghost">
              Volver a revisar
            </Btn>
          </div>
          <p className="text-[12px] text-haze">
            Los ciclos con fecha límite pasada se marcan como pagados. Los futuros quedan pendientes con su monto. Si importas dos veces,
            se actualizan en lugar de duplicarse.
          </p>
        </motion.div>
      )}
    </form>
  );
}
