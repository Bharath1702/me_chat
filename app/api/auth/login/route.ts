import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { loginUser, toPublicUser } from "@/lib/services/auth-service";
import { getActiveCoupleForUser } from "@/lib/services/couple-service";
import { errorResponse, readJsonBody } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const rl = rateLimit({ storeName: "login", key: ip, maxRequests: 5, windowMs: 15 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "Too many login attempts. Please try again in 15 minutes." },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
      );
    }

    const body = await readJsonBody(request);
    const user = await loginUser(body);
    const { token, expiresAt } = await createSession(user._id);
    const couple = await getActiveCoupleForUser(user._id);

    const response = NextResponse.json({
      ok: true,
      user: toPublicUser(user),
      redirectTo: couple ? "/chat" : "/connect",
    });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error, "login");
  }
}
