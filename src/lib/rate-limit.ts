type Bucket = { count: number; start: number };

type RateLimitStore = Map<string, Bucket>;

const globalStore = globalThis as typeof globalThis & {
  platformRateLimitBuckets?: RateLimitStore;
};

function store(): RateLimitStore {
  if (!globalStore.platformRateLimitBuckets) {
    globalStore.platformRateLimitBuckets = new Map();
  }
  return globalStore.platformRateLimitBuckets;
}

/**
 * Small in-process fixed-window limiter. It is intentionally dependency-free
 * and best-effort: each server instance keeps its own counters. A shared store
 * (Redis/Supabase) should replace it if the platform is ever scaled sideways.
 */
export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): { allowed: boolean; retryAfterSeconds: number } {
  const now = Date.now();
  const buckets = store();
  const current = buckets.get(key);

  if (!current || now - current.start >= windowMs) {
    buckets.set(key, { count: 1, start: now });
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.start + windowMs - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function resetRateLimit(key: string): void {
  store().delete(key);
}

/** Visible for tests and process cleanup. */
export function clearRateLimits(): void {
  store().clear();
}

export function clientIpFromRequest(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    request.headers.get("x-real-ip")?.trim() ||
    "local"
  );
}
