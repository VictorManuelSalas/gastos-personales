"use client";

import { useEffect, useState } from "react";
import { GlassCard } from "@/components/ui/glass-card";

type InstallPrompt = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Mode = "loading" | "installed" | "ready" | "ios" | "unavailable";

export function InstallCard() {
  const [mode, setMode] = useState<Mode>("loading");
  const [prompt, setPrompt] = useState<InstallPrompt | null>(null);

  useEffect(() => {
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    if (standalone) return setMode("installed");
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return setMode("ios");
    setMode("unavailable");

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setPrompt(e as InstallPrompt);
      setMode("ready");
    };
    const onInstalled = () => setMode("installed");
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);

  async function install() {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setMode("installed");
    setPrompt(null);
  }

  const copy: Record<Mode, { title: string; body: string }> = {
    loading: { title: "Instala Quincena", body: "Revisando tu dispositivo…" },
    installed: { title: "Ya vive en tu pantalla", body: "Quincena está instalada. Ábrela desde su ícono, como cualquier app." },
    ready: { title: "Instala Quincena", body: "Un toque y queda en tu pantalla de inicio, a pantalla completa." },
    ios: { title: "Instala Quincena", body: "En Safari: Compartir → Agregar a inicio." },
    unavailable: {
      title: "Instala Quincena",
      body: "En Android, ábrela en Chrome desde tu dominio con HTTPS y aparecerá el botón Instalar.",
    },
  };

  return (
    <GlassCard as="article" className="flex flex-col p-7">
      <p className="eyebrow">App</p>
      <h3 className="mt-4 text-2xl font-semibold leading-tight tracking-tight">{copy[mode].title}</h3>
      <p className="mt-3 text-[14px] leading-relaxed text-mist">{copy[mode].body}</p>
      <div className="mt-auto pt-6">
        {mode === "ready" ? (
          <button onClick={install} className="btn btn-primary rounded-full px-5 py-2.5 text-[14px]">
            Instalar app
          </button>
        ) : mode === "installed" ? (
          <span className="inline-flex items-center gap-2 text-[13px] text-mint">
            <span className="h-1.5 w-1.5 rounded-full bg-mint" />
            Instalada
          </span>
        ) : null}
      </div>
    </GlassCard>
  );
}
