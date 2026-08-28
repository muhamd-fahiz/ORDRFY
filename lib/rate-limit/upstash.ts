import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import type { RateLimiter, RateLimitResult } from "./types";

export class UpstashRateLimiter implements RateLimiter {
  private readonly limiter: Ratelimit;

  constructor(limit: number, windowSeconds: number) {
    this.limiter = new Ratelimit({
      redis: Redis.fromEnv(),
      limiter: Ratelimit.fixedWindow(limit, `${windowSeconds} s`),
    });
  }

  async check(key: string): Promise<RateLimitResult> {
    const { success, remaining, reset } = await this.limiter.limit(key);
    return { success, remaining, resetAt: new Date(reset) };
  }
}
