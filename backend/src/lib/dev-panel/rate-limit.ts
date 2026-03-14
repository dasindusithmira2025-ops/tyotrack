interface RateLimitState {
  attempts: number[];
}

const ATTEMPT_WINDOW_MS = 60_000;
const MAX_ATTEMPTS = 5;
const buckets = new Map<string, RateLimitState>();

function pruneOldAttempts(attempts: number[], now: number) {
  const cutoff = now - ATTEMPT_WINDOW_MS;
  while (attempts.length && attempts[0] < cutoff) {
    attempts.shift();
  }
}

export function checkVerifyRateLimit(key: string): { allowed: boolean; remaining: number; retryAfterMs: number } {
  const now = Date.now();
  const bucket = buckets.get(key) ?? { attempts: [] };
  pruneOldAttempts(bucket.attempts, now);

  if (bucket.attempts.length >= MAX_ATTEMPTS) {
    const retryAfterMs = Math.max(1_000, ATTEMPT_WINDOW_MS - (now - bucket.attempts[0]));
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterMs
    };
  }

  bucket.attempts.push(now);
  buckets.set(key, bucket);

  return {
    allowed: true,
    remaining: Math.max(0, MAX_ATTEMPTS - bucket.attempts.length),
    retryAfterMs: 0
  };
}
