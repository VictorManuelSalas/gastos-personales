import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/app",
    name: "Quincena",
    short_name: "Quincena",
    description: "Tus tarjetas, tus quincenas y tus metas, en claro.",
    lang: "es-MX",
    start_url: "/app",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0b0c12",
    theme_color: "#0b0c12",
    categories: ["finance", "productivity"],
    icons: [
      { src: "/icons/192?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/512?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
