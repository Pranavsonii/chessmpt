import { ArgumentsHost, Catch, ExceptionFilter, Logger } from '@nestjs/common';
import { AllExceptionsFilter } from '../common/filters/all-exceptions.filter';
import { fail } from './ws-ack';

/**
 * The socket twin of AllExceptionsFilter. Anything thrown while handling an event
 * (a failed ValidationPipe, NotFoundException in a service, a bug...) is answered
 * through the client's ack callback as { ok: false, error }, using the exact same
 * error codes as REST. Without this, Nest would emit a generic 'exception' event
 * and the client's callback would never fire.
 */
@Catch()
export class WsExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(WsExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const { status, error } = AllExceptionsFilter.toErrorBody(exception);
    if (status >= 500) {
      this.logger.error(
        exception instanceof Error ? exception.stack : String(exception),
      );
    }

    // Nest's ws args are [socket, payload, ack?, pattern]; the ack callback is only
    // there if the client emitted with one, so look for it rather than index it.
    const ack = host
      .getArgs()
      .find((arg: unknown) => typeof arg === 'function') as
      ((response: unknown) => void) | undefined;
    ack?.(fail(error));
  }
}
