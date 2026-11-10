import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { Aura } from "@/components/ui/aura";
import { SwRegister } from "@/components/sw-register";
import "./globals.css";

const geist = Geist({ subsets: ["latin"], variable: "--font-geist", display: "swap" });
const geistMono = Geist_Mono({ subsets: ["latin"], variable: "--font-geist-mono", display: "swap" });

export const metadata: Metadata = {
  title: { default: "Quincena", template: "%s · Quincena" },
  description: "Tus tarjetas, tus quincenas y tus metas, en claro. Solo para tu círculo.",
  applicationName: "Quincena",
  appleWebApp: { capable: true, title: "Quincena", statusBarStyle: "black-translucent" },
  formatDetection: { telephone: false },
  icons: { icon: "/icons/192?v=2", apple: "/icons/apple?v=2" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#0b0c12",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-MX" className={`${geist.variable} ${geistMono.variable}`}>
      <body className="min-h-dvh bg-night font-sans text-ink antialiased">
        <Aura />
        <div className="relative z-10">{children}</div>
        <SwRegister />
      </body>
    </html>
  );
}
