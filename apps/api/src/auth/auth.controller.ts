import { Body, Controller, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { NodeEnv, type EnvironmentVariables } from '../config/env.validation';
import { AUTH_COOKIE, authCookieOptions } from './auth.cookie';
import { AuthService } from './auth.service';
import type { PublicUser } from './auth.types';
import { Public } from './decorators';
import { LoginDto } from './dto/login.dto';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly config: ConfigService<EnvironmentVariables, true>,
  ) {}

  private cookieOptions() {
    return authCookieOptions(
      this.config.get('JWT_TTL_SECONDS', { infer: true }),
      this.config.get('NODE_ENV', { infer: true }) === NodeEnv.Production,
    );
  }

  /** POST /api/v1/auth/login → 200 + Set-Cookie; the token is never in the body. */
  @Public()
  @Post('login')
  @HttpCode(200)
  async login(
    @Body() dto: LoginDto,
    // passthrough: we set a cookie but Nest still serialises the return value (and the envelope applies)
    @Res({ passthrough: true }) res: Response,
  ): Promise<PublicUser> {
    const { user, token } = await this.auth.login(dto.email, dto.password);
    res.cookie(AUTH_COOKIE, token, this.cookieOptions());
    return user;
  }

  /** POST /api/v1/auth/logout → 204. Public so an expired session can still clear its cookie. */
  @Public()
  @Post('logout')
  @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response): void {
    res.clearCookie(AUTH_COOKIE, this.cookieOptions());
  }
}
