/**
 * Tiny in-memory sliding-window rate limiter (per process).
 * Good enough for a single-node deployment; swap for Redis in a cluster.
 */
type Bucket = { hits: number[]; };

const buckets = new Map<string, Bucket>();

export function rateLimit(key: string, limit: number, windowMs: number): { allowed: boolean; retryAfterSec: number } {
  const now = Date.now();
  const b = buckets.get(key) ?? { hits: [] };
  b.hits = b.hits.filter((t) => now - t < windowMs);
  if (b.hits.length >= limit) {
    buckets.set(key, b);
    const oldest = b.hits[0];
    return { allowed: false, retryAfterSec: Math.ceil((windowMs - (now - oldest)) / 1000) };
  }
  b.hits.push(now);
  buckets.set(key, b);
  // occasional cleanup to avoid unbounded growth
  if (buckets.size > 5000) {
    for (const [k, v] of buckets) {
      if (v.hits.every((t) => now - t > windowMs)) buckets.delete(k);
    }
  }
  return { allowed: true, retryAfterSec: 0 };
}

/** Throwing variant with Persian message */
export async function limitOrThrow(key: string, limit: number, windowMs: number, message?: string) {
  const r = rateLimit(key, limit, windowMs);
  if (!r.allowed) {
    const { ApiError } = await import("./http");
    throw new ApiError(429, message ?? `درخواست‌های شما بیش از حد مجاز است؛ ${r.retryAfterSec} ثانیه بعد تلاش کنید`);
  }
}

export function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
