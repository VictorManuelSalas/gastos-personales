"use client";

import { driver, type DriveStep } from "driver.js";
import "driver.js/dist/driver.css";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { markTourSeenAction } from "@/server/actions/settings";

/** El primer elemento visible: la navegación existe dos veces (arriba en escritorio, abajo en el teléfono). */
const visible = (selector: string) => () =>
  [...document.querySelectorAll(selector)].find((el) => el.getClientRects().length > 0) as Element;

const STEPS: (DriveStep & { selector?: string })[] = [
  {
    popover: {
      title: "Bienvenido a Quincena",
      description: "En un minuto te enseñamos a leer tu quincena. Puedes saltarlo y verlo cuando quieras desde Ajustes.",
    },
  },
  {
    selector: '[data-tour="disponible"]',
    popover: {
      title: "Lo que te queda",
      description: "Es lo que te quedará al terminar esta quincena, ya restando lo pendiente. Si sale en rojo, no alcanza para todo.",
    },
  },
  {
    selector: '[data-tour="resumen"]',
    popover: {
      title: "Saldo, por entrar y por pagar",
      description:
        "Saldo hoy: lo que tienes en tus cuentas. Por entrar: tus ingresos que aún no caen. Por pagar: tarjetas, servicios y metas de esta quincena.",
    },
  },
  {
    selector: '[data-tour="esta-quincena"]',
    popover: {
      title: "Esta quincena",
      description:
        "Cada pago y cobro hasta tu próximo día de pago. Toca «Pagar» cuando pagues algo y «Confirmar» cuando te caiga tu sueldo, con el monto real.",
    },
  },
  {
    selector: '[data-tour="proximas"]',
    popover: {
      title: "Próximas quincenas",
      description: "Así vienen tus siguientes quincenas con lo que esperas recibir y pagar. Te ayuda a ver venir una quincena apretada.",
    },
  },
  {
    selector: '[data-tour="nav-list"]',
    popover: { title: "Movimientos", description: "Registra aquí tus gastos e ingresos del día a día: con tarjeta, débito o efectivo." },
  },
  {
    selector: '[data-tour="nav-card"]',
    popover: { title: "Tarjetas", description: "Tus tarjetas y préstamos: fecha de corte, fecha límite y cuánto pagar en cada ciclo." },
  },
  {
    selector: '[data-tour="nav-more"]',
    popover: { title: "Más", description: "Cuentas, ingresos, servicios, metas, análisis, importar tu Excel y ajustes." },
  },
  {
    selector: '[data-tour="avisos"]',
    popover: { title: "Avisos", description: "Te avisamos antes de cada fecha límite. También te pueden llegar por Telegram o como notificación." },
  },
  {
    selector: '[data-tour="cuenta"]',
    popover: {
      title: "Tu cuenta",
      description: "Ajustes y cerrar sesión. En varias pantallas verás un «?» con ayuda de esa sección. ¡Listo!",
    },
  },
];

/** El layout no se vuelve a pedir al navegar: esto evita reabrirlo al regresar a Inicio. */
let closedThisVisit = false;

/** Recorrido guiado de Inicio: se abre solo la primera vez y con /app?recorrido=1 desde Ajustes. */
export function AppTour({ autoStart }: { autoStart: boolean }) {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    if (pathname !== "/app") return;
    const requested = new URLSearchParams(window.location.search).has("recorrido");
    if (!requested && (!autoStart || closedThisVisit)) return;

    // Espera a que terminen las animaciones de entrada para medir bien cada elemento.
    const timer = setTimeout(() => {
      const steps = STEPS.flatMap(({ selector, ...step }) => {
        if (!selector) return [step];
        // Centrado sobre el elemento: alineado al inicio se sale de la pantalla en el teléfono.
        return visible(selector)() ? [{ ...step, element: visible(selector), popover: { align: "center" as const, ...step.popover } }] : [];
      });
      const tour = driver({
        steps,
        showProgress: true,
        progressText: "{{current}} de {{total}}",
        nextBtnText: "Siguiente",
        prevBtnText: "Anterior",
        doneBtnText: "Terminar",
        popoverClass: "quincena-tour",
        overlayColor: "#05060a",
        overlayOpacity: 0.72,
        stagePadding: 8,
        stageRadius: 18,
        onDestroyed: () => {
          closedThisVisit = true;
          if (autoStart) void markTourSeenAction();
          if (requested) router.replace("/app");
        },
      });
      tour.drive();
    }, 1200);
    return () => clearTimeout(timer);
  }, [pathname, autoStart, router]);

  return null;
}
