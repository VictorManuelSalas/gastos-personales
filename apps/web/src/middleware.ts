import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

// Filtro rápido por cookie; cada página valida la sesión completa en el servidor.
export function middleware(req: NextRequest) {
  if (getSessionCookie(req)) return NextResponse.next();
  const url = new URL("/entrar", req.url);
  return NextResponse.redirect(url);
}

export const config = { matcher: ["/app/:path*"] };
