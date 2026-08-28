import type { RateLimiter } from "./types";
import { MemoryRateLimiter } from "./memory";
import { UpstashRateLimiter } from "./upstash";

const cache = new Map<string, RateLimiter>();

/**
 * Returns an Upstash-backed limiter when UPSTASH_REDIS_REST_URL/TOKEN are configured,
 * otherwise falls back to an in-memory limiter (local dev). Instances are cached per
 * (limit, windowSeconds) pair so the in-memory limiter's counters actually persist across
 * requests within the same process instead of resetting on every call.
 */
export function getRateLimiter(name: string, limit: number, windowSeconds: number): RateLimiter {
  const cacheKey = `${name}:${limit}:${windowSeconds}`;
  const existing = cache.get(cacheKey);
  if (existing) return existing;

  const limiter: RateLimiter =
    process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
      ? new UpstashRateLimiter(limit, windowSeconds)
      : new MemoryRateLimiter(limit, windowSeconds * 1000);

  cache.set(cacheKey, limiter);
  return limiter;
}
