import {
  Body,
  Controller,
  HttpCode,
  HttpException,
  Ip,
  Post,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { NodeEnv, type EnvironmentVariables } from '../config/env.validation';
import { AUTH_COOKIE, authCookieOptions } from './auth.cookie';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.types';
import { Public } from './decorators';
import { LoginDto } from './dto/login.dto';
import { LoginRateLimiter } from './login-rate-limiter';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
    private readonly limiter: LoginRateLimiter,
  ) {}

  private cookieOptions() {
    return authCookieOptions(
      this.config.get('JWT_TTL_SECONDS', { infer: true }),
      this.config.get('COOKIE_SECURE', { infer: true }) !== undefined
        ? this.config.get('COOKIE_SECURE', { infer: true }) === 'true'
        : this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
    );
  }

  /**
   * POST /api/v1/auth/login → 200 + Set-Cookie; the token is never in the body.
   * 429 + Retry-After after 5 failed attempts from one IP for one email.
   */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    @Ip() ip: string, // the real client IP: app.setup.ts trusts the Next.js proxy's X-Forwarded-For
    // passthrough: we set a cookie but Nest still serialises the return value (and the envelope applies)
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    try {
      this.limiter.assertAllowed(ip, dto.email);
    } catch (err) {
      if (err instanceof HttpException) {
        const { details } = err.getResponse() as {
          details: { retryAfterSeconds: number };
        };
        res.setHeader('Retry-After', String(details.retryAfterSeconds));
      }
      throw err;
    }

    try {
      const { user, token } = await this.auth.login(dto.email, dto.password);
      this.limiter.recordSuccess(ip, dto.email);
      res.cookie(AUTH_COOKIE, token, this.cookieOptions());
      return user;
    } catch (err) {
      if (err instanceof UnauthorizedException) {
        this.limiter.recordFailure(ip, dto.email);
      }
      throw err;
    }
  }

  /** POST /api/v1/auth/logout → 204. Public so an expired session can still clear its cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, this.cookieOptions());
  }
}
