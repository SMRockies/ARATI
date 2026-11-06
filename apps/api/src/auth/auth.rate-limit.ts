import { CanActivate, ExecutionContext, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { FixedWindowLimiter } from '../rate-limit/fixed-window.js';

/** Attempts from one address across all accounts, per window. */
export const AUTH_LOGIN_IP_LIMIT = 30;
/** Attempts against one account from one address, per window. */
export const AUTH_LOGIN_ACCOUNT_LIMIT = 10;
export const AUTH_LOGIN_WINDOW_MS = 5 * 60 * 1000;

/**
 * Per-address throttle for `POST /api/v1/auth/login`.
 *
 * This complements the per-account lockout in `AuthController` and does not
 * replace it. The two close different holes:
 *
 * - The lockout (`MAX_FAILED_LOGINS` / `LOGIN_LOCK_MS`) stops repeated guessing
 *   against one account, but it only fires after a correct email is known, so
 *   spraying one password across many accounts never trips it.
 * - The lockout is also a denial-of-service lever: anyone who knows a colleague's
 *   email can lock them out with five bad passwords. A per-address window limits
 *   how often an attacker can even attempt that.
 *
 * Two keys are kept so a shared office NAT does not become one bucket: the
 * address total is generous, while the address+account pair is tight. A locked
 * account is only ever one key, never the whole office.
 *
 * In-memory and per-process, like the market limiter — see `FixedWindowLimiter`
 * for the trade-off.
 */
@Injectable()
export class AuthLoginRateLimitGuard implements CanActivate {
  private readonly byAddress = new FixedWindowLimiter(AUTH_LOGIN_IP_LIMIT, AUTH_LOGIN_WINDOW_MS);
  private readonly byAddressAndAccount = new FixedWindowLimiter(AUTH_LOGIN_ACCOUNT_LIMIT, AUTH_LOGIN_WINDOW_MS);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest<Request>();
    const address = request.ip || request.socket.remoteAddress || 'unknown';

    // Guards run before the ValidationPipe, so the body is parsed but unvalidated.
    const rawEmail = (request.body as { email?: unknown } | undefined)?.email;
    const email = typeof rawEmail === 'string' ? rawEmail.trim().toLowerCase() : '';

    const keys = email ? [`${address}|${email}`] : [];
    const waits = [this.byAddress.take(`ip:${address}`)];
    for (const key of keys) waits.push(this.byAddressAndAccount.take(`account:${key}`));

    const limited = waits.filter((seconds): seconds is number => seconds !== null);
    if (limited.length === 0) return true;

    throw new HttpException(
      {
        code: 'RATE_LIMITED',
        message: 'Too many sign-in attempts; try again shortly.',
        retryAfterSeconds: Math.max(...limited),
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}
