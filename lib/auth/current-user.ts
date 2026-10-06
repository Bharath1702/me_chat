
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SESSION_COOKIE } from "./constants";
import { getUserFromSessionToken } from "./session";
import type { UserDocument } from "@/models/User";

/** Per-request memoised lookup of the authenticated user (Server Components only). */
export const getCurrentUser = cache(async (): Promise<UserDocument | null> => {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  try {
    return await getUserFromSessionToken(token);
  } catch (error) {
    console.error("[auth] session lookup failed", error);
    return null;
  }
});

export async function requireUser(): Promise<UserDocument> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}
