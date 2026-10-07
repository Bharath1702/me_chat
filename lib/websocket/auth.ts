import type { IncomingMessage } from "node:http";
import type { WebSocket } from "ws";

import { SESSION_COOKIE } from "../auth/constants";
import { getUserFromSessionToken } from "../auth/session";
import { getActiveCoupleForUser } from "../services/couple-service";
import type { UserDocument } from "@/models/User";

export type AuthenticatedSocket = WebSocket & {
  isAlive?: boolean;
  isFocused?: boolean;
  userId?: string;
  coupleId?: string;
  partnerId?: string;
};

export async function authenticateSocket(req: IncomingMessage): Promise<{
  user: UserDocument;
  coupleId: string;
  partnerId: string;
} | null> {
  try {
    const cookieHeader = req.headers.cookie;
    const cookies: Record<string, string> = {};
    if (cookieHeader) {
      for (const pair of cookieHeader.split(";")) {
        const [k, v] = pair.split("=");
        if (k && v) cookies[k.trim()] = decodeURIComponent(v.trim());
      }
    }
    const token = cookies[SESSION_COOKIE];
    if (!token) return null;

    const user = await getUserFromSessionToken(token);
    if (!user) return null;

    const couple = await getActiveCoupleForUser(user._id);
    if (!couple) return null;

    const partnerId = couple.userA.equals(user._id) ? couple.userB.toString() : couple.userA.toString();

    return {
      user,
      coupleId: couple._id.toString(),
      partnerId,
    };
  } catch (err) {
    console.error("[ws:auth] Error authenticating socket connection:", err);
    return null;
  }
}
