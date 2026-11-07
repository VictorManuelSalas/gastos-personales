import { Brand } from "@/components/ui/brand";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="gutter flex min-h-dvh flex-col" style={{ paddingBlock: "max(24px, env(safe-area-inset-top))" }}>
      <header className="mx-auto w-full max-w-5xl pt-2">
        <Brand />
      </header>
      <main className="mx-auto grid w-full max-w-5xl flex-1 items-center gap-14 py-14 md:grid-cols-[1.05fr_.95fr]">
        {children}
      </main>
    </div>
  );
}
