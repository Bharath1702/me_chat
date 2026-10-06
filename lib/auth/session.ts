
import { createHmac, randomBytes } from "node:crypto";
import type { Types } from "mongoose";
import { connectToDatabase } from "@/lib/mongodb";
import { Session } from "@/models/Session";
import { User, type UserDocument } from "@/models/User";
import { SESSION_TTL_MS } from "./constants";

const TOKEN_REGEX = /^[A-Za-z0-9_-]{43}$/; // 32 random bytes, base64url

function getAuthSecret(): string {
  const secret = process.env.AUTH_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error("AUTH_SECRET must be set to at least 32 characters");
  }
  return secret;
}

export function hashToken(token: string): string {
  return createHmac("sha256", getAuthSecret()).update(token).digest("hex");
}

export async function createSession(
  userId: Types.ObjectId,
  now: Date = new Date(),
): Promise<{ token: string; expiresAt: Date }> {
  await connectToDatabase();
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(now.getTime() + SESSION_TTL_MS);
  await Session.create({ userId, tokenHash: hashToken(token), expiresAt });
  return { token, expiresAt };
}

/** Resolves the user for a raw session token, or null if missing/invalid/expired. */
export async function getUserFromSessionToken(
  token: string | undefined | null,
  now: Date = new Date(),
): Promise<UserDocument | null> {
  if (!token || !TOKEN_REGEX.test(token)) return null;
  await connectToDatabase();

  const session = await Session.findOne({ tokenHash: hashToken(token) }).lean();
  if (!session) return null;

  if (session.expiresAt.getTime() <= now.getTime()) {
    await Session.deleteOne({ _id: session._id });
    return null;
  }

  return User.findById(session.userId).lean<UserDocument>();
}

export async function revokeSession(token: string | undefined | null): Promise<void> {
  if (!token || !TOKEN_REGEX.test(token)) return;
  await connectToDatabase();
  await Session.deleteOne({ tokenHash: hashToken(token) });
}

export function sessionCookieOptions(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    expires: expiresAt,
  };
}

export function expiredCookieOptions() {
  return { ...sessionCookieOptions(new Date(0)), maxAge: 0 };
}
