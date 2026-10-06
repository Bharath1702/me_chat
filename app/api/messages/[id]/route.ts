import { NextRequest, NextResponse } from "next/server";
import { requireRequestUser, errorResponse } from "@/lib/utils/api";
import {
  editMessageService,
  deleteMessageService,
} from "@/lib/services/message-service";
import { sendToUser } from "@/lib/websocket/manager";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function PATCH(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRequestUser(req);
    const { id } = await params;
    const body = await req.json();
    const content = body?.content;

    const { message, receiverId } = await editMessageService(
      user._id,
      id,
      content
    );

    // Broadcast message update via WS
    sendToUser(user._id.toString(), { type: "message_updated", message });
    sendToUser(receiverId, { type: "message_updated", message });

    return NextResponse.json({ message });
  } catch (err: unknown) {
    return errorResponse(err, "messages:edit");
  }
}

export async function DELETE(req: NextRequest, { params }: RouteParams) {
  try {
    const user = await requireRequestUser(req);
    const { id } = await params;
    const { searchParams } = new URL(req.url);
    const forEveryone = searchParams.get("forEveryone") === "true";

    const { message, receiverId } = await deleteMessageService(
      user._id,
      id,
      forEveryone
    );

    sendToUser(user._id.toString(), { type: "message_updated", message });
    if (forEveryone) {
      sendToUser(receiverId, { type: "message_updated", message });
    }

    return NextResponse.json({ message });
  } catch (err: unknown) {
    return errorResponse(err, "messages:delete");
  }
}
