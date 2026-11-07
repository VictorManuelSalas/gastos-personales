import { ImageResponse } from "next/og";

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
  const glyph = Math.round(px * (maskable ? 0.42 : 0.52));

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
        <div
          style={{
            width: glyph * 1.5,
            height: glyph * 1.5,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            borderRadius: glyph * 0.42,
            background: "linear-gradient(180deg, #dfe4ff 0%, #8fa8ff 100%)",
          }}
        >
          <svg width={glyph} height={glyph} viewBox="0 0 24 24" fill="none">
            <path
              d="M12 3v18M7 7.5c0-1.9 2.2-3 5-3s5 1.1 5 3-2.2 2.6-5 3.3-5 1.6-5 3.7 2.2 3 5 3 5-1.1 5-3"
              stroke="#0d0e15"
              strokeWidth="2.4"
              strokeLinecap="round"
            />
          </svg>
        </div>
      </div>
    ),
    {
      width: px,
      height: px,
      headers: { "Cache-Control": "public, max-age=604800, immutable" },
    },
  );
}
