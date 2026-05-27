/**
 * Simple in-memory rate limiter using sliding window algorithm.
 * No external dependencies required.
 *
 * Usage:
 *   const limiter = new RateLimiter({ windowMs: 60_000, maxRequests: 20 });
 *   const result = limiter.check(userId);
 *   if (!result.allowed) { return 429 response }
 */

interface RateLimiterOptions {
    /** Time window in milliseconds */
    windowMs: number;
    /** Maximum number of requests allowed in the window */
    maxRequests: number;
}

interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number; // Unix timestamp (ms) when the window resets
}

interface WindowEntry {
    timestamps: number[];
}

export class RateLimiter {
    private windows: Map<string, WindowEntry> = new Map();
    private readonly windowMs: number;
    private readonly maxRequests: number;

    constructor(options: RateLimiterOptions) {
        this.windowMs = options.windowMs;
        this.maxRequests = options.maxRequests;

        // Cleanup stale entries every 5 minutes to prevent memory leaks
        setInterval(() => this.cleanup(), 5 * 60 * 1000);
    }

    /**
     * Check if a request from the given key is allowed.
     * If allowed, the request is counted against the limit.
     */
    check(key: string): RateLimitResult {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        let entry = this.windows.get(key);
        if (!entry) {
            entry = { timestamps: [] };
            this.windows.set(key, entry);
        }

        // Remove timestamps outside the current window
        entry.timestamps = entry.timestamps.filter((t) => t > windowStart);

        const remaining = Math.max(0, this.maxRequests - entry.timestamps.length);
        const resetAt = entry.timestamps.length > 0
            ? entry.timestamps[0] + this.windowMs
            : now + this.windowMs;

        if (entry.timestamps.length >= this.maxRequests) {
            return { allowed: false, remaining: 0, resetAt };
        }

        // Record this request
        entry.timestamps.push(now);

        return {
            allowed: true,
            remaining: remaining - 1,
            resetAt,
        };
    }

    /** Remove entries that have no recent timestamps (stale users). */
    private cleanup() {
        const now = Date.now();
        const windowStart = now - this.windowMs;

        for (const [key, entry] of this.windows.entries()) {
            entry.timestamps = entry.timestamps.filter((t) => t > windowStart);
            if (entry.timestamps.length === 0) {
                this.windows.delete(key);
            }
        }
    }
}

// ─── Pre-configured limiter instances ────────────────────────────

/** Chat API: 20 requests per minute per user */
export const chatRateLimiter = new RateLimiter({
    windowMs: 60 * 1000,    // 1 minute
    maxRequests: 20,
});
