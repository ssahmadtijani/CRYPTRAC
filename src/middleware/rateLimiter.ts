/**
 * In-memory rate limiting middleware for CRYPTRAC.
 * Uses a sliding-window counter keyed by IP address.
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

function createStore(): Map<string, RateLimitEntry> {
  return new Map();
}

export interface RateLimitOptions {
  maxRequests: number;
  windowMs: number;
  message?: string;
}

export function rateLimiter(options: RateLimitOptions) {
  const { maxRequests, windowMs, message = 'Too many requests. Please try again later.' } =
    options;

  const store = createStore();

  const cleanup = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of store.entries()) {
      if (entry.resetAt <= now) {
        store.delete(key);
      }
    }
  }, windowMs);

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
