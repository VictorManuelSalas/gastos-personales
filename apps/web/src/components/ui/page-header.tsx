import type { ReactNode } from "react";
import { Help } from "./help";

export function PageHeader({
  eyebrow,
  title,
  help,
  children,
}: {
  eyebrow: string;
  title: ReactNode;
  /** Explicación de la pantalla detrás de un «?». */
  help?: { title: string; items: string[] };
  children?: ReactNode;
}) {
  return (
    <section>
      <div className="rise flex items-center gap-2.5">
        <p className="eyebrow">{eyebrow}</p>
        {help ? <Help title={help.title} items={help.items} /> : null}
      </div>
      <h1 className="rise d1 mt-5 text-[clamp(2.6rem,7vw,5rem)] font-semibold leading-[0.95] tracking-tighter chrome">{title}</h1>
      {children ? <div className="rise d2 mt-6 max-w-xl text-lg leading-relaxed text-mist">{children}</div> : null}
    </section>
  );
}

export function Label({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return (
    <label htmlFor={htmlFor} className="block text-[12px] text-haze">
      {children}
    </label>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-[28px] border border-dashed border-white/10 px-6 py-12 text-center">
      <p className="text-[16px] font-medium">{title}</p>
      {children ? <div className="mx-auto mt-2 max-w-sm text-[14px] leading-relaxed text-mist">{children}</div> : null}
    </div>
  );
}
