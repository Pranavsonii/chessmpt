import type { CookieOptions } from 'express';

export const AUTH_COOKIE = 'access_token';

/**
 * - httpOnly: JavaScript in the page cannot read it, so an XSS bug cannot steal the token.
 * - sameSite 'lax': not sent on cross-site POST/fetch, which blocks CSRF; still sent on normal navigation.
 * - secure: only over HTTPS in production (browsers treat localhost as secure anyway).
 * - maxAge: same lifetime as the JWT inside it.
 */
export function authCookieOptions(
  ttlSeconds: number,
  secure: boolean,
): CookieOptions {
  return {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: ttlSeconds * 1000, // Express expects milliseconds
  };
}
