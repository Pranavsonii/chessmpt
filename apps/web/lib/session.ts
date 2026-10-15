import { decodeJwt } from "jose";
import type { Role } from "./api/types";

/** Must match AUTH_COOKIE in apps/api/src/auth/auth.cookie.ts. */
export const AUTH_COOKIE = "access_token";

export const homeFor = (role: Role) => (role === "coach" ? "/coach" : "/student");

/**
 * Reads role + expiry from the JWT WITHOUT verifying the signature.
 *
 * That is deliberate: this only drives redirects in proxy.ts (an "optimistic check").
 * The API verifies the signature on every request, so a forged cookie gets a page
 * shell at most, and every data request on it fails with 401. Not verifying here
 * also means the JWT secret lives only in the API.
 */
export function readSession(token: string | undefined): { role: Role } | null {
  if (!token) return null;
  try {
    const { role, exp } = decodeJwt(token);
    if (role !== "coach" && role !== "student") return null;
    if (typeof exp === "number" && exp * 1000 <= Date.now()) return null;
    return { role };
  } catch {
    return null;
  }
}

/** Only allow redirects to our own paths ("/x"), never "//evil.com" or "https://...". */
export function safeNextPath(next: string | null | undefined): string | null {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) {
    return null;
  }
  return next;
}
