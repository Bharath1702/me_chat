import { NextResponse, type NextRequest } from "next/server";
import { generateUploadAuthorizationService } from "@/lib/services/message-service";
import { storageProvider } from "@/lib/storage/r2";
import { errorResponse, requireRequestUser } from "@/lib/utils/api";
import { AppError } from "@/lib/utils/errors";

export async function POST(request: NextRequest) {
  try {
    const user = await requireRequestUser(request);
    const formData = await request.formData();
    
    const file = formData.get("file") as File | null;
    const kind = formData.get("kind") as "image" | "audio" | null;

    if (!file || !kind) {
      throw new AppError("VALIDATION", "File and kind are required.", 400);
    }

    // Authorize & generate storage key
    const auth = await generateUploadAuthorizationService(
      user._id,
      kind,
      file.type,
      file.size
    );

    // Upload via server S3 client directly to R2 bucket (bypasses browser CORS restrictions)
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (storageProvider.uploadBufferDirectly) {
      await storageProvider.uploadBufferDirectly(auth.storageKey, buffer, file.type);
    }

    return NextResponse.json({
      ok: true,
      storageKey: auth.storageKey,
      publicUrl: auth.publicUrl,
    });
  } catch (error) {
    return errorResponse(error, "media-upload");
  }
}
