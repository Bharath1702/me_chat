
import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/constants";
import { getUserFromSessionToken } from "@/lib/auth/session";
import { AppError, GENERIC_ERROR } from "@/lib/utils/errors";
import type { UserDocument } from "@/models/User";

/**
 * Requires a JSON body. Insisting on application/json also blocks simple
 * cross-site form posts (they cannot set this content type without CORS).
 */
export async function readJsonBody(request: NextRequest): Promise<unknown> {
  const contentType = request.headers.get("content-type") ?? "";
  if (!contentType.toLowerCase().startsWith("application/json")) {
    throw new AppError("INVALID_REQUEST", "Invalid request.", 415);
  }
  try {
    return await request.json();
  } catch {
    throw new AppError("INVALID_REQUEST", "Invalid request.", 400);
  }
}

/** Authenticates from the session cookie only. Never trusts IDs in the request. */
export async function requireRequestUser(request: NextRequest): Promise<UserDocument> {
  const user = await getUserFromSessionToken(request.cookies.get(SESSION_COOKIE)?.value);
  if (!user) throw new AppError("UNAUTHORIZED", "Please log in to continue.", 401);
  return user;
}

export function errorResponse(error: unknown, context: string): NextResponse {
  if (error instanceof AppError) {
    return NextResponse.json({ ok: false, error: error.message, code: error.code }, { status: error.status });
  }
  // Full detail stays server-side; the client only sees a generic message.
  console.error(`[api:${context}]`, error);
  return NextResponse.json({ ok: false, error: GENERIC_ERROR }, { status: 500 });
}
