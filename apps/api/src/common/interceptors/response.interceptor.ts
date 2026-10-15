import {
  CallHandler,
  ExecutionContext,
  HttpStatus,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import type { Response } from 'express';
import { Observable, map } from 'rxjs';
import { ApiSuccess, WithMeta } from '../api-response';

const NO_CONTENT: number = HttpStatus.NO_CONTENT;

/**
 * Wraps every successful HTTP handler result in the standard envelope.
 * Handlers just return their data; they never build the envelope themselves.
 */
@Injectable()
export class ResponseInterceptor implements NestInterceptor<
  unknown,
  ApiSuccess<unknown> | undefined
> {
  intercept(
    context: ExecutionContext,
    next: CallHandler<unknown>,
  ): Observable<ApiSuccess<unknown> | undefined> {
    // Only shape HTTP responses; WebSocket handlers use their own ack format.
    if (context.getType() !== 'http') {
      return next.handle() as Observable<ApiSuccess<unknown>>;
    }

    const res = context.switchToHttp().getResponse<Response>();

    return next.handle().pipe(
      map((result) => {
        // 204 No Content must not have a body.
        if (res.statusCode === NO_CONTENT) {
          return undefined;
        }

        if (result instanceof WithMeta) {
          const { data, meta } = result as WithMeta<unknown>;
          return { success: true, data, meta };
        }
        return { success: true, data: result ?? null };
      }),
    );
  }
}
