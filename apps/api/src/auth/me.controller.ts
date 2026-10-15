import { Controller, Get } from '@nestjs/common';
import { AuthService } from './auth.service';
import type { AuthUser, PublicUser } from './auth.types';
import { CurrentUser } from './decorators';

/** GET /api/v1/me: the logged-in user (any role). */
@Controller('me')
export class MeController {
  constructor(private readonly auth: AuthService) {}

  @Get()
  me(@CurrentUser() user: AuthUser): Promise<PublicUser> {
    return this.auth.getMe(user.id);
  }
}
