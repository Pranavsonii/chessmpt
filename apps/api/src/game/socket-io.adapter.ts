import type { INestApplicationContext } from '@nestjs/common';
import { IoAdapter } from '@nestjs/platform-socket.io';
import type { ServerOptions } from 'socket.io';

/**
 * Socket.IO server locked to the web origin.
 *
 * - cors: same policy as REST, with credentials so the browser may send the auth
 *   cookie on the cross-port handshake (applies to the HTTP long-polling transport).
 * - allowRequest: browsers do NOT apply CORS to a WebSocket upgrade, so another site
 *   could otherwise open a socket that carries our cookie (cross-site WebSocket
 *   hijacking). Checking the Origin header closes that.
 */
export class SocketIoAdapter extends IoAdapter {
  constructor(
    app: INestApplicationContext,
    private readonly webOrigin: string,
  ) {
    super(app);
  }

  createIOServer(port: number, options?: ServerOptions): unknown {
    const allowRequest: ServerOptions['allowRequest'] = (req, callback) =>
      callback(null, req.headers.origin === this.webOrigin);

    return super.createIOServer(port, {
      ...options,
      cors: { origin: this.webOrigin, credentials: true },
      allowRequest,
    });
  }
}
