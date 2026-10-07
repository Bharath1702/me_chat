import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { User } from "@/models/User";
import { connectToDatabase } from "@/lib/mongodb";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  return NextResponse.json({
    ok: true,
    settings: {
      notificationPreview: user.notificationPreview ?? true,
    },
  });
}

export async function PATCH(request: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json(
        { ok: false, error: "Authentication required.", code: "UNAUTHORIZED" },
        { status: 401 }
      );
    }

    const body = await request.json().catch(() => null);
    if (!body || typeof body !== "object") {
      return NextResponse.json(
        { ok: false, error: "Invalid payload.", code: "VALIDATION" },
        { status: 400 }
      );
    }

    await connectToDatabase();
    const updateData: Record<string, unknown> = {};

    if (typeof body.notificationPreview === "boolean") {
      updateData.notificationPreview = body.notificationPreview;
    }

    const updatedUser = await User.findByIdAndUpdate(
      user._id,
      { $set: updateData },
      { new: true }
    );

    return NextResponse.json({
      ok: true,
      settings: {
        notificationPreview: updatedUser?.notificationPreview ?? true,
      },
    });
  } catch (err) {
    console.error("[PATCH /api/me/settings] Error:", err);
    return NextResponse.json(
      { ok: false, error: "Failed to update settings.", code: "SERVER_ERROR" },
      { status: 500 }
    );
  }
}
