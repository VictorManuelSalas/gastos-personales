"use client";

import { useEffect, useState } from "react";
import { savePushSubscriptionAction } from "@/server/actions/notifications";

type State = "loading" | "unsupported" | "denied" | "off" | "on" | "working" | "error";

const toKey = (b64: string) => {
  const pad = "=".repeat((4 - (b64.length % 4)) % 4);
  const raw = atob((b64 + pad).replace(/-/g, "+").replace(/_/g, "/"));
  return Uint8Array.from([...raw].map((c) => c.charCodeAt(0)));
};

/** Activa las notificaciones push en este dispositivo (requiere la app instalada y HTTPS). */
export function PushToggle({ publicKey }: { publicKey: string | null }) {
  const [state, setState] = useState<State>("loading");

  useEffect(() => {
    if (!publicKey || !("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) return setState("unsupported");
    if (Notification.permission === "denied") return setState("denied");
    navigator.serviceWorker.getRegistration().then(async (reg) => {
      const sub = await reg?.pushManager.getSubscription();
      setState(sub ? "on" : "off");
    });
  }, [publicKey]);

  async function enable() {
    if (!publicKey) return;
    setState("working");
    try {
      const perm = await Notification.requestPermission();
      if (perm !== "granted") return setState(perm === "denied" ? "denied" : "off");
      const reg = (await navigator.serviceWorker.getRegistration()) ?? (await navigator.serviceWorker.register("/sw.js"));
      await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: toKey(publicKey) });
      const json = sub.toJSON() as { endpoint: string; keys: { p256dh: string; auth: string } };
      const res = await savePushSubscriptionAction(json);
      setState(res.ok ? "on" : "error");
    } catch {
      setState("error");
    }
  }

  const text: Record<State, string> = {
    loading: "Revisando…",
    unsupported: publicKey ? "Este navegador no permite notificaciones. Instala la app en Android (Chrome) para recibirlas." : "Las notificaciones push no están configuradas en el servidor.",
    denied: "Bloqueaste las notificaciones. Actívalas en los ajustes del navegador para este sitio.",
    off: "Recibe los avisos también como notificación del teléfono.",
    on: "Activadas en este dispositivo.",
    working: "Activando…",
    error: "No se pudieron activar. Revisa que la app esté instalada y abierta por HTTPS.",
  };

  return (
    <div className="flex flex-wrap items-center gap-4">
      <p className={`min-w-0 flex-1 text-[14px] ${state === "on" ? "text-mint" : "text-mist"}`}>{text[state]}</p>
      {state === "off" || state === "error" ? (
        <button type="button" onClick={enable} className="btn btn-primary rounded-xl px-5 py-3 text-[14px]">
          Activar notificaciones
        </button>
      ) : null}
    </div>
  );
}
