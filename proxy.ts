import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";

/**
 * Next.js Middleware: Optimistically gates protected routes (/chat, /connect)
 * without a session cookie to /login before rendering.
 * Full security validation occurs server-side in API routes and server components.
 */
export function proxy(request: NextRequest) {
  const { pathname, searchParams } = request.nextUrl;

  if (pathname.startsWith("/chat") || pathname.startsWith("/connect")) {
    if (!request.cookies.has(SESSION_COOKIE)) {
      const code = searchParams.get("code") || searchParams.get("connect");
      const redirectUrl = new URL("/register", request.url);
      if (code) {
        redirectUrl.searchParams.set("code", code);
      }
      return NextResponse.redirect(redirectUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/connect/:path*", "/chat/:path*"],
};
