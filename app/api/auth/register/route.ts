import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { createSession, sessionCookieOptions } from "@/lib/auth/session";
import { registerUser, toPublicUser } from "@/lib/services/auth-service";
import { errorResponse, readJsonBody } from "@/lib/utils/api";
import { rateLimit } from "@/lib/utils/rate-limit";

export async function POST(request: NextRequest) {
  try {
    const ip = request.headers.get("x-forwarded-for")?.split(",")[0].trim() || "127.0.0.1";
    const rl = rateLimit({ storeName: "register", key: ip, maxRequests: 3, windowMs: 60 * 60 * 1000 });
    if (!rl.success) {
      return NextResponse.json(
        { ok: false, error: "Too many registration attempts. Please try again later." },
        { status: 429, headers: { "Retry-After": Math.ceil((rl.resetAt - Date.now()) / 1000).toString() } }
      );
    }

    const body = await readJsonBody(request);
    const user = await registerUser(body);
    const { token, expiresAt } = await createSession(user._id);

    const response = NextResponse.json({ ok: true, user: toPublicUser(user) }, { status: 201 });
    response.cookies.set(SESSION_COOKIE, token, sessionCookieOptions(expiresAt));
    return response;
  } catch (error) {
    return errorResponse(error, "register");
  }
}
