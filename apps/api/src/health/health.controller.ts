import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators';

/** GET /api/v1/health — liveness check (later also used by Docker). */
@Public()
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
