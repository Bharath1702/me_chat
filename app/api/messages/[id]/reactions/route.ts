import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, errorResponse } from "@/lib/utils/api";
import { toggleReactionService } from "@/lib/services/message-service";
import { sendToUser } from "@/lib/websocket/manager";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRequestUser(req);
    const { id } = await params;
    const body = await req.json();
    const emoji = body?.emoji;

    const { message, receiverId } = await toggleReactionService(
      user._id,
      id,
      emoji
    );

    sendToUser(user._id.toString(), { type: "message_updated", message });
    sendToUser(receiverId, { type: "message_updated", message });

    return NextResponse.json({ message });
  } catch (err: unknown) {
    return errorResponse(err, "messages:reaction");
  }
}
