import { Injectable, NestMiddleware } from '@nestjs/common';
import { NextFunction, Request, Response } from 'express';

const attempts = new Map<string, { count: number; resetAt: number }>();

@Injectable()
export class RateLimitMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction) {
    const key = req.ip ?? 'unknown';
    const now = Date.now();
    const entry = attempts.get(key);

    if (!entry || entry.resetAt < now) {
      attempts.set(key, { count: 1, resetAt: now + 60_000 });
      next();
      return;
    }

    if (entry.count >= 10) {
      res.status(429).json({ success: false, error: { code: 'RATE_LIMITED', message: 'Too many requests' } });
      return;
    }

    entry.count += 1;
    next();
  }
}
