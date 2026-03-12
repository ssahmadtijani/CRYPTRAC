/**
 * In-memory rate limiting middleware for CRYPTRAC.
 * Uses a sliding-window counter keyed by IP address.
 * No external dependencies required.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

/** Per-route state so different limiters are independent. */
function createStore(): Map<string, RateLimitEntry> {
  return new Map();
}

export interface RateLimitOptions {
  /** Maximum number of requests allowed within `windowMs`. */
  maxRequests: number;
  /** Window duration in milliseconds. */
  windowMs: number;
  /** Human-readable message returned when limit is exceeded. */
  message?: string;
}

/**
 * Returns an Express middleware that enforces a sliding-window rate limit.
 *
 * Usage:
 *   router.post('/login', rateLimiter({ maxRequests: 10, windowMs: 60_000 }), handler)
 */
export function rateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, message = 'Too many requests. Please try again later.' } =
    options;

  const store = createStore();

  // Periodically clean up expired entries to prevent memory leaks.
  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, windowMs);

  // Allow the Node.js process to exit even if the interval is still running.
  if (cleanup.unref) {
    cleanup.unref();
  }

  return function rateLimitMiddleware(
    req: Request,
    res: Response,
    next: NextFunction
  ): void {
    const ip =
      (req.headers['x-forwarded-for'] as string)?.split(',')[0].trim() ??
      req.socket.remoteAddress ??
      'unknown';

    const now = Date.now();
    const entry = store.get(ip);

    if (!entry || entry.resetAt <= now) {
      // Start a fresh window for this IP.
      store.set(ip, { count: 1, resetAt: now + windowMs });
      next();
      return;
    }

    entry.count += 1;

    if (entry.count > maxRequests) {
      const retryAfterSecs = Math.ceil((entry.resetAt - now) / 1000);

      logger.warn('Rate limit exceeded', { ip, path: req.path });

      res.setHeader('Retry-After', String(retryAfterSecs));
      res.status(429).json({
        success: false,
        error: {
          message,
          code: 'RATE_LIMIT_EXCEEDED',
          retryAfterSeconds: retryAfterSecs,
        },
      });
      return;
    }

    next();
  };
}

// ---------------------------------------------------------------------------
// Pre-configured limiters for common use-cases
// ---------------------------------------------------------------------------

/** Strict limiter for auth endpoints (login, register): 10 req / minute. */
export const authRateLimiter = rateLimiter({
  maxRequests: 10,
  windowMs: 60_000,
  message: 'Too many authentication attempts. Please try again in a minute.',
});

/** General API limiter: 100 req / minute. */
export const apiRateLimiter = rateLimiter({
  maxRequests: 100,
  windowMs: 60_000,
});

/** Compliance operations limiter: 30 req / minute. */
export const complianceRateLimiter = rateLimiter({
  maxRequests: 30,
  windowMs: 60_000,
});
