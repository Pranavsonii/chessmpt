import { HttpException, HttpStatus, Injectable } from '@nestjs/common';

/** Failed logins allowed per (client IP, email) before a cool-down. */
export const MAX_LOGIN_FAILURES = 5;
export const LOGIN_LOCK_MS = 15 * 60_000;
/** Stop the map growing without bound under a spray of random emails. */
const MAX_TRACKED_KEYS = 10_000;

interface Entry {
  failures: number;
  /** When the window (and any lock) ends. */
  resetAt: number;
}

/**
 * Brute-force protection for POST /auth/login (OWASP ASVS 2.2.1).
 *
 * Counts FAILED attempts per (IP, email) in a fixed 15-minute window; after 5 the
 * pair is refused with 429 until the window ends. A success clears the count.
 *
 * Keying on IP + email (not email alone) means an attacker can't lock a real user
 * out from somewhere else, and keying on email too (not IP alone) means students
 * behind one school NAT don't throttle each other.
 *
 * In memory: one API process. Several instances would keep this in Redis.
 */
@Injectable()
export class LoginRateLimiter {
  private readonly entries = new Map<string, Entry>();

  /** Throws 429 TOO_MANY_LOGIN_ATTEMPTS while the pair is locked. */
  assertAllowed(ip: string, email: string, now = Date.now()): void {
    const entry = this.live(ip, email, now);
    if (!entry || entry.failures < MAX_LOGIN_FAILURES) return;
    const retryAfterSeconds = Math.ceil((entry.resetAt - now) / 1000);
    throw new HttpException(
      {
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        message: `Too many failed attempts. Try again in ${Math.ceil(retryAfterSeconds / 60)} minute(s).`,
        details: { retryAfterSeconds },
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }

  recordFailure(ip: string, email: string, now = Date.now()): void {
    const k = key(ip, email);
    const entry = this.live(ip, email, now);
    if (entry) {
      entry.failures += 1;
      return;
    }
    if (this.entries.size >= MAX_TRACKED_KEYS) this.purge(now);
    this.entries.set(k, { failures: 1, resetAt: now + LOGIN_LOCK_MS });
  }

  recordSuccess(ip: string, email: string): void {
    this.entries.delete(key(ip, email));
  }

  /** The entry if its window hasn't ended yet (expired ones are dropped). */
  private live(ip: string, email: string, now: number): Entry | undefined {
    const k = key(ip, email);
    const entry = this.entries.get(k);
    if (entry && entry.resetAt <= now) {
      this.entries.delete(k);
      return undefined;
    }
    return entry;
  }

  private purge(now: number): void {
    for (const [k, e] of this.entries)
      if (e.resetAt <= now) this.entries.delete(k);
  }
}

const key = (ip: string, email: string) =>
  `${ip}|${email.trim().toLowerCase()}`;
