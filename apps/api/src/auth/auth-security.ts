import { createHash, randomBytes } from 'node:crypto';
import type { Request, Response } from 'express';

export const SESSION_COOKIE = 'arati_session';
export const SESSION_IDLE_MS = 30 * 60 * 1000;
export const SESSION_ABSOLUTE_MS = 12 * 60 * 60 * 1000;
export const SESSION_REFRESH_MS = 5 * 60 * 1000;
export const MAX_FAILED_LOGINS = 5;
export const LOGIN_LOCK_MS = 15 * 60 * 1000;

export function createSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashSessionToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

export function readSessionToken(request: Request, production: boolean): string | undefined {
  const cookieName = production ? '__Host-arati_session' : SESSION_COOKIE;
  const cookieHeader = request.headers.cookie;
  if (!cookieHeader) return undefined;

  for (const part of cookieHeader.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0 || part.slice(0, separator).trim() !== cookieName) continue;
    const token = part.slice(separator + 1).trim();
    return /^[A-Za-z0-9_-]{43}$/u.test(token) ? token : undefined;
  }
  return undefined;
}

export function setSessionCookie(response: Response, token: string | undefined, production: boolean, maxAgeSeconds = 0): void {
  const name = production ? '__Host-arati_session' : SESSION_COOKIE;
  const parts = [`${name}=${token ?? ''}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (production) parts.push('Secure');
  response.setHeader('Set-Cookie', parts.join('; '));
}

export function hasValidMutationOrigin(request: Request, expectedOrigins: string | readonly string[]): boolean {
  const origin = request.header('origin');
  if (!origin) return false;
  const allowed = Array.isArray(expectedOrigins) ? expectedOrigins : [expectedOrigins as string];
  try {
    const requestOrigin = new URL(origin).origin;
    return allowed.some((candidate) => {
      try {
        return new URL(candidate).origin === requestOrigin;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

export function hasOrganizationScope(
  memberships: Array<{ organizationId: string; branchId: string | null; permissions: string[] }>,
  organizationId: string,
  branchId: string | undefined,
  permission: string
): boolean {
  const matches = memberships.filter((membership) =>
    membership.organizationId === organizationId &&
    (membership.permissions.includes('*') || membership.permissions.includes(permission)),
  );
  if (branchId) return matches.some((membership) => membership.branchId === null || membership.branchId === branchId);
  return matches.length > 0;
}
