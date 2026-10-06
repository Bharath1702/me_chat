import { NextResponse, type NextRequest } from "next/server";
import { generateUploadAuthorizationService } from "@/lib/services/message-service";
import { errorResponse, readJsonBody, requireRequestUser } from "@/lib/utils/api";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const body = (await readJsonBody(request)) as {
      kind: "image" | "audio";
      mimeType: string;
      size: number;
    };

    const result = await generateUploadAuthorizationService(
      user._id,
      body.kind,
      body.mimeType,
      body.size
    );

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    return errorResponse(error, "media-authorize");
  }
}
