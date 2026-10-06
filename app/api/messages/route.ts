import { NextResponse, type NextRequest } from "next/server";
import { getMessagesService, markMessagesAsReadService } from "@/lib/services/message-service";
import { errorResponse, requireRequestUser } from "@/lib/utils/api";

export async function GET(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const { searchParams } = new URL(request.url);
    const before = searchParams.get("before") || undefined;
    const limit = searchParams.get("limit") ? Number(searchParams.get("limit")) : 50;

    const result = await getMessagesService(user._id, before, limit);
    
    // Auto-mark unread messages as read when loading history
    await markMessagesAsReadService(user._id);

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "messages");
  }
}
