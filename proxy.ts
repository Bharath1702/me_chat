import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Next.js Middleware: Optimistically gates protected routes (/chat, /connect)
 * without a session cookie to /login before rendering.
 * Full security validation occurs server-side in API routes and server components.
 */
export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/chat") || pathname.startsWith("/connect")) {
    if (!request.cookies.has(SESSION_COOKIE)) {
      return NextResponse.redirect(new URL("/login", request.url));
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/connect/:path*", "/chat/:path*"],
};
