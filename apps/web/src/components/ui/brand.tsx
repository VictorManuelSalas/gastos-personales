import Link from "next/link";

export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="grid place-items-center rounded-[9px] bg-gradient-to-b from-[#dfe4ff] to-glow text-[#0d0e15]"
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size * 0.54} height={size * 0.54} viewBox="0 0 24 24" fill="none">
        <path
          d="M12 3v18M7 7.5c0-1.9 2.2-3 5-3s5 1.1 5 3-2.2 2.6-5 3.3-5 1.6-5 3.7 2.2 3 5 3 5-1.1 5-3"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
        />
      </svg>
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
