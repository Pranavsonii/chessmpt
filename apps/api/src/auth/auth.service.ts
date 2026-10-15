import { Inject, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { DB, type Database } from '../db/client';
import { users } from '../db/schema';
import { AuthUser, JwtPayload, PublicUser, toPublicUser } from './auth.types';

/**
 * A real bcrypt hash of a throwaway string. When the email doesn't exist we still
 * compare against it, so "unknown email" takes as long as "wrong password" and an
 * attacker can't discover which emails are registered by timing the response.
 */
const DUMMY_HASH = bcrypt.hashSync('timing-equaliser', 10);

const INVALID_CREDENTIALS = {
  code: 'INVALID_CREDENTIALS',
  message: 'Invalid email or password',
};

@Injectable()
export class AuthService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly jwt: JwtService,
  ) {}

  /** Checks credentials and returns the user plus a signed JWT. */
  async login(
    email: string,
    password: string,
  ): Promise<{ user: PublicUser; token: string }> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.email, email.trim().toLowerCase()),
    });

    const passwordOk = await bcrypt.compare(
      password,
      user?.passwordHash ?? DUMMY_HASH,
    );
    // Same error for both cases: don't reveal whether the email exists.
    if (!user || !passwordOk) {
      throw new UnauthorizedException(INVALID_CREDENTIALS);
    }

    const payload: JwtPayload = { sub: user.id, role: user.role };
    const token = await this.jwt.signAsync(payload);
    return { user: toPublicUser(user), token };
  }

  /**
   * Verifies signature + expiry and returns who the token belongs to, or null.
   * Used by the HTTP guard now and by the Socket.IO handshake later.
   */
  verifyToken(token: string): AuthUser | null {
    return this.verifySession(token)?.user ?? null;
  }

  /**
   * Like verifyToken, plus when the token expires (epoch ms). A Socket.IO connection
   * outlives the request that opened it, so the gateway uses this to drop the
   * socket the moment the session it was opened with ends.
   */
  verifySession(token: string): { user: AuthUser; expiresAt: number } | null {
    try {
      const payload = this.jwt.verify<Partial<JwtPayload> & { exp?: number }>(
        token,
      );
      const roleOk = payload.role === 'coach' || payload.role === 'student';
      if (typeof payload.sub !== 'string' || !roleOk) return null;
      if (typeof payload.exp !== 'number') return null; // we always sign with an expiry
      return {
        user: { id: payload.sub, role: payload.role! },
        expiresAt: payload.exp * 1000,
      };
    } catch {
      return null; // bad signature, expired, malformed...
    }
  }

  /** GET /me: fresh data from the DB (the token only carries id + role). */
  async getMe(userId: string): Promise<PublicUser> {
    const user = await this.db.query.users.findFirst({
      where: eq(users.id, userId),
    });
    if (!user) {
      // Valid token but the account no longer exists.
      throw new UnauthorizedException({
        code: 'USER_NOT_FOUND',
        message: 'Account not found, please log in again',
      });
    }
    return toPublicUser(user);
  }
}
