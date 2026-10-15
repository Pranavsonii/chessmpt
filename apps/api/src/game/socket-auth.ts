import { parse } from 'cookie';
import { AUTH_COOKIE } from '../auth/auth.cookie';

/**
 * Pulls the JWT out of the raw `Cookie` header of the WebSocket upgrade request.
 * The browser sends the same httpOnly cookie it sends to REST, so sockets need no
 * separate token (and page JavaScript never has to touch it).
 */
export function tokenFromCookieHeader(
  header: string | undefined,
): string | null {
  if (!header) return null;
  const token = parse(header)[AUTH_COOKIE];
  return token ? token : null;
}
