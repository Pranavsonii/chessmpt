import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Response } from 'express';
import { ApiErrorBody, ApiFailure } from '../api-response';

/** Default machine-readable codes when a handler throws without its own `code`. */
const DEFAULT_CODES: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHORIZED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  405: 'METHOD_NOT_ALLOWED',
  409: 'CONFLICT',
  422: 'UNPROCESSABLE_ENTITY',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_ERROR',
};

/**
 * Turns ANY thrown error into the standard error envelope with the right HTTP status.
 *
 * Usage in services:
 *   throw new ConflictException({ code: 'ALREADY_JOINED', message: 'You already joined' });
 *   throw new NotFoundException('Tournament not found');   // code defaults to NOT_FOUND
 *
 * Unknown errors (bugs, DB down...) become a 500 with a generic message,
 * so internal details never leak to the client; the real error is logged.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    // WebSocket errors are handled by the gateway's ack format, not here.
    if (host.getType() !== 'http') throw exception;

    const res = host.switchToHttp().getResponse<Response>();
    const { status, error } = AllExceptionsFilter.toErrorBody(exception);

    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    const body: ApiFailure = { success: false, error };
    res.status(status).json(body);
  }

  /** Pure mapping from an exception to (status, error body). Exported for unit tests. */
  static toErrorBody(exception: unknown): {
    status: number;
    error: ApiErrorBody;
  } {
    if (!(exception instanceof HttpException)) {
      return {
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        error: { code: 'INTERNAL_ERROR', message: 'Something went wrong' },
      };
    }

    const status = exception.getStatus();
    const response = exception.getResponse();
    const fallbackCode = DEFAULT_CODES[status] ?? `HTTP_${status}`;

    // new XException('some message') -> response is a string
    if (typeof response === 'string') {
      return { status, error: { code: fallbackCode, message: response } };
    }

    // new XException({ code, message, details }) or Nest's default { statusCode, message, error }
    const r = response as {
      code?: unknown;
      message?: unknown;
      details?: unknown;
    };
    const message = Array.isArray(r.message)
      ? r.message.join(', ')
      : typeof r.message === 'string'
        ? r.message
        : exception.message;

    const error: ApiErrorBody = {
      code: typeof r.code === 'string' ? r.code : fallbackCode,
      message,
    };
    if (r.details !== undefined) error.details = r.details;

    return { status, error };
  }
}
