import Link from "next/link";

/** Símbolo de Quincena: una Q plateada con una flecha que sube. También lo usan los íconos de la PWA. */
export function QGlyph({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <defs>
        <linearGradient id="q-chrome" x1="4" y1="3" x2="20" y2="21" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#f4f5f8" />
          <stop offset="0.45" stopColor="#dfe4ff" />
          <stop offset="1" stopColor="#8fa8ff" />
        </linearGradient>
        <filter id="q-glow" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="0.7" result="b" />
          <feFlood floodColor="#8fa8ff" floodOpacity="0.7" />
          <feComposite in2="b" operator="in" />
          <feMerge>
            <feMergeNode />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <g stroke="url(#q-chrome)" strokeLinecap="round" strokeLinejoin="round" filter="url(#q-glow)">
        <circle cx="11.2" cy="11.2" r="7" strokeWidth="2.6" />
        <path d="M13.2 14.4C15.4 16.6 17.6 18.3 20.8 18.6" strokeWidth="2.6" />
        <path d="M8.3 14.1 14 8.4M10.2 8.3H14.1V12.2" strokeWidth="2.1" />
      </g>
    </svg>
  );
}

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[9px] ring-1 ring-glow/30"
      style={{ width: size, height: size, background: "radial-gradient(circle at 30% 20%, #26306a 0%, #121427 60%, #0b0c12 100%)" }}
      aria-hidden="true"
    >
      <QGlyph size={Math.round(size * 0.78)} />
    </span>
  );
}

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="flex items-center gap-2.5 text-[15px] font-semibold tracking-tight">
      <BrandMark />
      Quincena
    </Link>
  );
}
