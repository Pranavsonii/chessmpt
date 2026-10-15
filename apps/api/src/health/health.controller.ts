import { Controller, Get } from '@nestjs/common';

/** GET /api/v1/health — liveness check (later also used by Docker). */
@Controller('health')
export class HealthController {
  @Get()
  check() {
    return { status: 'ok', uptime: Math.round(process.uptime()) };
  }
}
