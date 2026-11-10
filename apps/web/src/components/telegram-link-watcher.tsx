"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/** La vinculación termina en Telegram: al volver a la app se recarga el estado para mostrar "Conectado". */
export function TelegramLinkWatcher() {
  const router = useRouter();
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") router.refresh();
    };
    document.addEventListener("visibilitychange", refresh);
    window.addEventListener("focus", refresh);
    window.addEventListener("pageshow", refresh);
    return () => {
      document.removeEventListener("visibilitychange", refresh);
      window.removeEventListener("focus", refresh);
      window.removeEventListener("pageshow", refresh);
    };
  }, [router]);
  return null;
}
