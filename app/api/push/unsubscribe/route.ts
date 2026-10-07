import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { unregisterPushSubscriptionService } from "@/lib/services/push-service";
import { checkRateLimit } from "@/lib/services/message-service";
import { AppError } from "@/lib/utils/errors";

export async function POST(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    if (!checkRateLimit(user._id.toString())) {
      return NextResponse.json(
        { ok: false, error: "Too many unsubscription requests. Please try again later.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body.endpoint !== "string") {
      return NextResponse.json(
        { ok: false, error: "Invalid request payload. Endpoint required.", code: "VALIDATION" },
        { status: 400 }
      );
    }

    const result = await unregisterPushSubscriptionService(user._id, body.endpoint);

    return NextResponse.json({ ok: true, ...result });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[POST /api/push/unsubscribe] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to unregister push subscription.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
