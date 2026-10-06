import { NextResponse, type NextRequest } from "next/server";
import { toPublicUser } from "@/lib/services/auth-service";
import { getPartner } from "@/lib/services/couple-service";
import { errorResponse, requireRequestUser } from "@/lib/utils/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const partner = await getPartner(user._id);
    return NextResponse.json({ ok: true, user: toPublicUser(user), partner });
  } catch (error) {
    return errorResponse(error, "me");
  }
}
