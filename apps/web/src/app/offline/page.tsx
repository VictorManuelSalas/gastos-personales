import type { Metadata } from "next";

export const metadata: Metadata = { title: "Sin conexión" };

export default function OfflinePage() {
  return (
    <main className="gutter grid min-h-dvh place-items-center text-center">
      <div className="max-w-md">
        <p className="eyebrow">Sin conexión</p>
        <h1 className="mt-5 text-5xl font-semibold leading-none tracking-tighter chrome">Volvemos en un momento.</h1>
        <p className="mt-6 text-lg leading-relaxed text-mist">
          No hay internet o el servidor de casa está apagado. Tus datos están a salvo; abre la app de nuevo cuando
          vuelva la conexión.
        </p>
      </div>
    </main>
  );
}
