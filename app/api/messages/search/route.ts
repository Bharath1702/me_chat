import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, errorResponse } from "@/lib/utils/api";
import { searchMessagesService } from "@/lib/services/message-service";

export async function GET(req: NextRequest) {
  try {
    const user = await requireRequestUser(req);
    const { searchParams } = new URL(req.url);
    const query = searchParams.get("q") || "";

    const { messages } = await searchMessagesService(user._id, query);
    return NextResponse.json({ messages });
  } catch (err: unknown) {
    return errorResponse(err, "messages:search");
  }
}
