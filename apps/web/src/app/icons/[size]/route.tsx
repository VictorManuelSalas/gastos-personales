import { ImageResponse } from "next/og";
import { QGlyph } from "@/components/ui/brand";

// Íconos PNG de la PWA generados en el servidor (sin binarios en el repo).
const SIZES: Record<string, { px: number; maskable: boolean }> = {
  "192": { px: 192, maskable: false },
  "512": { px: 512, maskable: false },
  maskable: { px: 512, maskable: true },
  apple: { px: 180, maskable: true },
};

export async function GET(_req: Request, { params }: { params: Promise<{ size: string }> }) {
  const { size } = await params;
  const spec = SIZES[size];
  if (!spec) return new Response("Not found", { status: 404 });

  const { px, maskable } = spec;
  // Los íconos "maskable" dejan margen seguro (80 % central) para que Android los recorte.
  const glyph = Math.round(px * (maskable ? 0.62 : 0.74));

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "radial-gradient(circle at 30% 20%, #26306a 0%, #121427 55%, #0b0c12 100%)",
          borderRadius: maskable ? 0 : px * 0.22,
        }}
      >
        <QGlyph size={glyph} />
      </div>
    ),
    {
      width: px,
      height: px,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    },
  );
}
