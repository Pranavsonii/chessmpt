import { Logger, UseFilters, UsePipes } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
} from '@nestjs/websockets';
import type { Namespace, Socket } from 'socket.io';
import { AuthService } from '../auth/auth.service';
import type { AuthUser } from '../auth/auth.types';
import { buildValidationPipe } from '../common/pipes/validation.pipe';
import { TournamentsService } from '../tournaments/tournaments.service';
import { MatchIdDto, MoveDto, TournamentIdDto } from './dto/match.dto';
import { GameBroadcaster } from './game.broadcaster';
import { MatchEngine } from './match-engine.service';
import { rooms } from './rooms';
import { tokenFromCookieHeader } from './socket-auth';
import { ok } from './ws-ack';
import { WsExceptionFilter } from './ws-exception.filter';

/** What the handshake middleware stores on every accepted socket. */
interface SocketData {
  user: AuthUser;
}
// Socket<listen events, emit events, server-side events, socket.data>
export type GameSocket = Socket<any, any, any, SocketData>;

/**
 * Real-time entry point: ws://<api>/game.
 * CORS is configured in SocketIoAdapter (it needs WEB_ORIGIN from ConfigService,
 * which isn't loaded yet when this decorator runs).
 *
 * Global pipes/filters from app.setup.ts only cover HTTP, so validation and the
 * ack-shaped error handling are attached here explicitly.
 *
 * Handlers stay thin: authenticate (done at handshake), validate (pipe), delegate
 * to MatchEngine, ack. Errors thrown by the engine become { ok: false } acks.
 */
@WebSocketGateway({ namespace: '/game' })
@UsePipes(buildValidationPipe())
@UseFilters(new WsExceptionFilter())
export class GameGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  private readonly logger = new Logger(GameGateway.name);

  constructor(
    private readonly auth: AuthService,
    private readonly engine: MatchEngine,
    private readonly broadcaster: GameBroadcaster,
    private readonly tournaments: TournamentsService,
  ) {}

  /**
   * Authenticate once, at the handshake. The browser sends the httpOnly auth cookie
   * with the upgrade request; a missing/invalid one rejects the connection before
   * any handler can run, so every event below already knows socket.data.user.
   */
  afterInit(server: Namespace): void {
    this.broadcaster.bind(server);
    server.use((socket: GameSocket, next) => {
      const token = tokenFromCookieHeader(socket.handshake.headers.cookie);
      const user = token ? this.auth.verifyToken(token) : null;
      if (!user) {
        const err = new Error('UNAUTHORIZED') as Error & { data?: unknown };
        err.data = { code: 'UNAUTHORIZED', message: 'Please log in' };
        return next(err);
      }
      socket.data.user = user;
      next();
    });
  }

  /** Every socket joins its user's private room, so the server can reach all their tabs. */
  async handleConnection(socket: GameSocket): Promise<void> {
    const { user } = socket.data;
    await socket.join(rooms.user(user.id));
    this.logger.debug(`connected ${socket.id} (user ${user.id})`);
  }

  handleDisconnect(socket: GameSocket): void {
    this.logger.debug(`disconnected ${socket.id}`);
  }

  /**
   * Subscribe to a match and get a full snapshot. Clients call this on page load
   * and again on every reconnect, which is all reconnection needs.
   * The server checks you play in it; clients never pick rooms.
   */
  @SubscribeMessage('match:join')
  async joinMatch(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: MatchIdDto,
  ) {
    const snapshot = await this.engine.snapshotFor(
      dto.matchId,
      socket.data.user,
    );
    await socket.join(rooms.match(dto.matchId));
    return ok(snapshot);
  }

  /**
   * Follow a tournament page live (leaderboard, results, status). Same visibility
   * as REST: findOne throws for a draft a student can't see.
   */
  @SubscribeMessage('tournament:watch')
  async watchTournament(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: TournamentIdDto,
  ) {
    await this.tournaments.findOne(socket.data.user, dto.tournamentId);
    await socket.join(rooms.tournament(dto.tournamentId));
    return ok({ tournamentId: dto.tournamentId });
  }

  @SubscribeMessage('tournament:unwatch')
  async unwatchTournament(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: TournamentIdDto,
  ) {
    await socket.leave(rooms.tournament(dto.tournamentId));
    return ok({ tournamentId: dto.tournamentId });
  }

  /** Unsubscribe; harmless if you weren't in the room. */
  @SubscribeMessage('match:leave')
  async leaveMatch(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: MatchIdDto,
  ) {
    await socket.leave(rooms.match(dto.matchId));
    return ok({ matchId: dto.matchId });
  }

  /** The new position reaches both players via the match:moved broadcast; the ack just confirms. */
  @SubscribeMessage('match:move')
  async move(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: MoveDto,
  ) {
    const { matchId, ...move } = dto;
    return ok(await this.engine.move(matchId, socket.data.user, move));
  }

  @SubscribeMessage('match:resign')
  async resign(
    @ConnectedSocket() socket: GameSocket,
    @MessageBody() dto: MatchIdDto,
  ) {
    await this.engine.resign(dto.matchId, socket.data.user);
    return ok({ matchId: dto.matchId });
  }
}
