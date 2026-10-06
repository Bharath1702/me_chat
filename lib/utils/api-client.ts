import type { ApiResponse } from "@/types";

/** Small fetch wrapper for same-origin JSON APIs. The session travels in the HTTP-only cookie. */
export async function postJson<T extends object>(url: string, body: unknown): Promise<ApiResponse<T>> {
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "same-origin",
      body: JSON.stringify(body),
    });
    return (await res.json()) as ApiResponse<T>;
  } catch {
    return { ok: false, error: "Couldn't reach TwoChat. Check your connection and try again." };
  }
}
