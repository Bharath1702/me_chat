import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth/current-user";
import { getVapidPublicKey } from "@/lib/services/push-service";

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json(
      { ok: false, error: "Authentication required.", code: "UNAUTHORIZED" },
      { status: 401 }
    );
  }

  const publicKey = getVapidPublicKey();
  return NextResponse.json({ ok: true, publicKey });
}
