import type { RateLimiter, RateLimitResult } from "./types";

/**
 * Fixed-window in-memory limiter. Fine for local dev and a single long-lived process, but
 * does NOT share state across serverless instances -- production must use the Upstash
 * backend (lib/rate-limit/upstash.ts) once UPSTASH_REDIS_REST_URL/TOKEN are configured.
 * This exists so rate limiting can be built and tested now without requiring a real Upstash
 * account, matching the project's established "mock first" pattern for other providers.
 */
export class MemoryRateLimiter implements RateLimiter {
  private readonly hits = new Map<string, { count: number; windowStart: number }>();

  constructor(
    private readonly limit: number,
    private readonly windowMs: number,
  ) {}

  async check(key: string): Promise<RateLimitResult> {
    const now = Date.now();
    const existing = this.hits.get(key);

    if (!existing || now - existing.windowStart >= this.windowMs) {
      this.hits.set(key, { count: 1, windowStart: now });
      return { success: true, remaining: this.limit - 1, resetAt: new Date(now + this.windowMs) };
    }

    existing.count += 1;
    const resetAt = new Date(existing.windowStart + this.windowMs);

    if (existing.count > this.limit) {
      return { success: false, remaining: 0, resetAt };
    }

    return { success: true, remaining: this.limit - existing.count, resetAt };
  }
}
