import { INestApplication, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import cookieParser from 'cookie-parser';
import helmet from 'helmet';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { ResponseInterceptor } from './common/interceptors/response.interceptor';
import { buildValidationPipe } from './common/pipes/validation.pipe';
import type { EnvironmentVariables } from './config/env.validation';
import { SocketIoAdapter } from './game/socket-io.adapter';

/**
 * Global HTTP setup, shared by main.ts and the e2e tests so both run the exact same app.
 *
 * Resulting URLs: /api/v1/<resource>
 */
export function configureApp(app: INestApplication): void {
  const config = app.get(ConfigService<EnvironmentVariables, true>);

  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });

  const express = app.getHttpAdapter().getInstance() as {
    set(key: string, value: unknown): void;
    disable(key: string): void;
  };
  // Browsers reach the API through the Next.js rewrite proxy. Trust X-Forwarded-For
  // only from private/loopback hops (that proxy, Docker's network), so req.ip is the
  // real client IP (used by the login rate limiter) and can't be spoofed from outside.
  express.set('trust proxy', 'loopback, linklocal, uniquelocal');
  express.disable('x-powered-by'); // don't advertise the framework

  // Security headers: HSTS, nosniff, frame-ancestors 'none', no-referrer, CORP...
  // The API only serves JSON, so helmet's strict default CSP fits as-is.
  app.use(helmet());
  app.use(cookieParser());
  app.enableCors({
    origin: config.get('WEB_ORIGIN', { infer: true }),
    credentials: true, // allow the browser to send the auth cookie
  });

  // Socket.IO (GameGateway) with the same origin lock as REST.
  app.useWebSocketAdapter(
    new SocketIoAdapter(app, config.get('WEB_ORIGIN', { infer: true })),
  );

  app.useGlobalPipes(buildValidationPipe());
  app.useGlobalInterceptors(new ResponseInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();
}
