import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { expiredCookieOptions, revokeSession } from "@/lib/auth/session";

/** Deletes the server-side session, expires the cookie and redirects to /login. */
export async function POST(request: NextRequest) {
  try {
    await revokeSession(request.cookies.get(SESSION_COOKIE)?.value);
  } catch (error) {
    // Still clear the cookie so the user is logged out on this device.
    console.error("[api:logout]", error);
  }

  const response = NextResponse.redirect(new URL("/login", request.url), 303);
  response.cookies.set(SESSION_COOKIE, "", expiredCookieOptions());
  return response;
}
