import { NextResponse, type NextRequest } from "next/server";
import { connectWithPartner } from "@/lib/services/couple-service";
import { errorResponse, readJsonBody, requireRequestUser } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    // Identity comes from the session cookie; the body only carries the partner's ID.
    const user = await requireRequestUser(request);
    const body = await readJsonBody(request);
    const result = await connectWithPartner(user._id, body);
    return NextResponse.json({ ok: true, partner: result.partner }, { status: 201 });
  } catch (error) {
    return errorResponse(error, "connect");
  }
}
