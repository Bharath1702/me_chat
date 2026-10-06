/**
 * Simple in-memory sliding window rate limiter for API endpoints (e.g., auth attempts).
 * Automatically cleans up expired entries to prevent memory growth.
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const stores = new Map<string, Map<string, RateLimitEntry>>();

// Clean up expired entries every 5 minutes
if (typeof setInterval !== "undefined") {
  setInterval(() => {
    const now = Date.now();
    for (const store of stores.values()) {
      for (const [key, entry] of store.entries()) {
        if (now > entry.resetAt) {
          store.delete(key);
        }
      }
    }
  }, 5 * 60 * 1000);
}

export function rateLimit({
  storeName,
  key,
  maxRequests,
  windowMs,
}: {
  storeName: string;
  key: string;
  maxRequests: number;
  windowMs: number;
}): { success: boolean; limit: number; remaining: number; resetAt: number } {
  if (!stores.has(storeName)) {
    stores.set(storeName, new Map());
  }

  const store = stores.get(storeName)!;
  const now = Date.now();
  const entry = store.get(key);

  if (!entry || now > entry.resetAt) {
    const resetAt = now + windowMs;
    store.set(key, { count: 1, resetAt });
    return { success: true, limit: maxRequests, remaining: maxRequests - 1, resetAt };
  }

  if (entry.count >= maxRequests) {
    return { success: false, limit: maxRequests, remaining: 0, resetAt: entry.resetAt };
  }

  entry.count += 1;
  return { success: true, limit: maxRequests, remaining: maxRequests - entry.count, resetAt: entry.resetAt };
}
