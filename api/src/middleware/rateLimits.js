import { rateLimit } from 'express-rate-limit';
import { RedisStore } from 'rate-limit-redis';
import Redis from 'ioredis';

class RateLimitStorageError extends Error {}

export function handleRateLimitError(error, request, response, next) {
  let cause = error;
  for (let depth = 0; cause && depth < 5; depth++, cause = cause.cause) {
    if (cause instanceof RateLimitStorageError && !response.headersSent) {
      return response.status(503).json({
        error: 'Request protection is unavailable. Try again shortly.',
      });
    }
  }
  return next(error);
}

export function createRateLimits({
  redisUrl = process.env.REDIS_URL,
  prefix = 'agentzuno:rate:',
} = {}) {
  const redis = redisUrl
    ? new Redis(redisUrl, {
        connectTimeout: 3000,
        commandTimeout: 3000,
        maxRetriesPerRequest: 1,
        enableOfflineQueue: true,
      })
    : null;
  // Report a generic unavailable response; connection errors may contain infrastructure details.
  redis?.on('error', () => {});
  return {
    middleware(scope, options = {}) {
      return rateLimit({
        windowMs: 60000,
        limit: 120,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        message: { error: 'Too many attempts. Try again in a minute.' },
        ...options,
        passOnStoreError: false,
        ...(redis
          ? {
              store: new RedisStore({
                prefix: `${prefix}${scope}:`,
                sendCommand: async (...args) => {
                  try {
                    return await redis.call(...args);
                  } catch {
                    throw new RateLimitStorageError('Rate-limit storage unavailable.');
                  }
                },
              }),
            }
          : {}),
      });
    },
    close: async () => redis?.disconnect(),
  };
}

export function createRateLimiter(app, scope, options) {
  app.locals.rateLimits ||= createRateLimits();
  return app.locals.rateLimits.middleware(scope, options);
}
