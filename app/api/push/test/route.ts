import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { sendTestNotificationService } from "@/lib/services/push-service";
import { checkRateLimit } from "@/lib/services/message-service";
import { AppError } from "@/lib/utils/errors";

export async function POST() {
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
        { ok: false, error: "Too many test notification requests.", code: "RATE_LIMIT" },
        { status: 429 }
      );
    }

    const result = await sendTestNotificationService(user._id);

    return NextResponse.json({
      ok: true,
      message: "Test notification triggered.",
      ...result,
    });
  } catch (err: unknown) {
    if (err instanceof AppError) {
      return NextResponse.json(
        { ok: false, error: err.message, code: err.code },
        { status: err.status }
      );
    }
    console.error("[POST /api/push/test] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to send test notification.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
