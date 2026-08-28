export interface RateLimitResult {
  success: boolean;
  remaining: number;
  resetAt: Date;
}

export interface RateLimiter {
  /** `key` should already encode the limiter's identity (e.g. "login-ip:1.2.3.4"). */
  check(key: string): Promise<RateLimitResult>;
}
