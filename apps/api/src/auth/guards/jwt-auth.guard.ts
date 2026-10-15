import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AUTH_COOKIE } from '../auth.cookie';
import { AuthService } from '../auth.service';
import type { AuthedRequest } from '../auth.types';
import { IS_PUBLIC_KEY } from '../decorators';

/**
 * Registered globally (APP_GUARD), so every route requires a valid login cookie
 * unless it is marked @Public(). Forgetting a decorator fails closed (401), not open.
 *
 * Answers "who are you?" (authentication). RolesGuard answers "may you do this?".
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly auth: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    // Socket.IO connections are authenticated once at the handshake instead (Phase 7).
    if (context.getType() !== 'http') return true;

    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const req = context.switchToHttp().getRequest<AuthedRequest>();
    const token: unknown = req.cookies?.[AUTH_COOKIE];
    if (typeof token !== 'string' || token.length === 0) {
      throw new UnauthorizedException({
        code: 'NOT_AUTHENTICATED',
        message: 'Please log in',
      });
    }

    const user = this.auth.verifyToken(token);
    if (!user) {
      throw new UnauthorizedException({
        code: 'INVALID_SESSION',
        message: 'Your session is invalid or has expired, please log in again',
      });
    }

    req.user = user;
    return true;
  }
}
