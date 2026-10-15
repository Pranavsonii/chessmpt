import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../db/schema';
import type { AuthedRequest } from '../auth.types';
import { ROLES_KEY } from '../decorators';

/**
 * Runs after JwtAuthGuard (registration order), so req.user is already set.
 * Routes without @Roles() are open to any logged-in user.
 *
 * 401 = we don't know who you are. 403 = we know who you are, and you're not allowed.
 */
@Injectable()
export class RolesGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== 'http') return true;

    const required = this.reflector.getAllAndOverride<UserRole[] | undefined>(
      ROLES_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (!required || required.length === 0) return true;

    const { user } = context.switchToHttp().getRequest<AuthedRequest>();
    if (!user) {
      throw new UnauthorizedException({
        code: 'NOT_AUTHENTICATED',
        message: 'Please log in',
      });
    }

    if (!required.includes(user.role)) {
      throw new ForbiddenException({
        code: 'FORBIDDEN_ROLE',
        message: `Only a ${required.join(' or ')} can do this`,
      });
    }
    return true;
  }
}
