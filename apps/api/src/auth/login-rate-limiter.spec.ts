import { HttpException } from '@nestjs/common';
import {
  LOGIN_LOCK_MS,
  LoginRateLimiter,
  MAX_LOGIN_FAILURES,
} from './login-rate-limiter';

const T0 = 1_000_000;
const IP = '203.0.113.7';

function fail(limiter: LoginRateLimiter, times: number, email = 'a@koc.test') {
  for (let i = 0; i < times; i++) limiter.recordFailure(IP, email, T0);
}

describe('LoginRateLimiter', () => {
  it('allows attempts below the limit', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, MAX_LOGIN_FAILURES - 1);
    expect(() => limiter.assertAllowed(IP, 'a@koc.test', T0)).not.toThrow();
  });

  it('locks the (ip, email) pair with a 429 after too many failures', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, MAX_LOGIN_FAILURES);
    try {
      limiter.assertAllowed(IP, 'A@KOC.test ', T0 + 1000); // same email, other casing
      throw new Error('expected a 429');
    } catch (e) {
      expect(e).toBeInstanceOf(HttpException);
      const err = e as HttpException;
      expect(err.getStatus()).toBe(429);
      expect(err.getResponse()).toMatchObject({
        code: 'TOO_MANY_LOGIN_ATTEMPTS',
        details: { retryAfterSeconds: LOGIN_LOCK_MS / 1000 - 1 },
      });
    }
  });

  it('does not lock the same email from another IP, or another email', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, MAX_LOGIN_FAILURES);
    expect(() =>
      limiter.assertAllowed('198.51.100.1', 'a@koc.test', T0),
    ).not.toThrow();
    expect(() => limiter.assertAllowed(IP, 'b@koc.test', T0)).not.toThrow();
  });

  it('unlocks when the window ends', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, MAX_LOGIN_FAILURES);
    expect(() =>
      limiter.assertAllowed(IP, 'a@koc.test', T0 + LOGIN_LOCK_MS),
    ).not.toThrow();
  });

  it('a successful login clears the count', () => {
    const limiter = new LoginRateLimiter();
    fail(limiter, MAX_LOGIN_FAILURES - 1);
    limiter.recordSuccess(IP, 'a@koc.test');
    fail(limiter, MAX_LOGIN_FAILURES - 1);
    expect(() => limiter.assertAllowed(IP, 'a@koc.test', T0)).not.toThrow();
  });
});
