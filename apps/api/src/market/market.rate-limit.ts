import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { FixedWindowLimiter } from '../rate-limit/fixed-window.js';
import { MARKET_RATE_LIMIT, MARKET_RATE_WINDOW_MS } from './market.rules.js';

/**
 * Fixed-window rate limit for the unauthenticated market API. It is
 * per-process and in-memory by design: one API instance serves this small
 * business's storefront, and an in-memory window needs no new dependency or
 * shared state. See `FixedWindowLimiter` for the trade-off and the sweep that
 * keeps an address scan from growing the map without bound.
 */
@Injectable()
export class MarketRateLimitGuard implements CanActivate {
  private readonly windows = new FixedWindowLimiter(MARKET_RATE_LIMIT, MARKET_RATE_WINDOW_MS);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const key = request.ip || request.socket.remoteAddress || 'unknown';
    const retryAfterSeconds = this.windows.take(key);
    if (retryAfterSeconds === null) return true;

    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'Too many requests; retry later.',
        retryAfterSeconds,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
