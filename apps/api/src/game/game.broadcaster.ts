import { Injectable } from '@nestjs/common';
import type { Namespace } from 'socket.io';
import { rooms } from './rooms';

/**
 * Lets services push to rooms without depending on the gateway (which depends on
 * them). The gateway hands over its namespace once Socket.IO is up.
 */
@Injectable()
export class GameBroadcaster {
  private server: Namespace | null = null;

  bind(server: Namespace): void {
    this.server = server;
  }

  toMatch(matchId: string, event: string, payload: unknown): void {
    this.server?.to(rooms.match(matchId)).emit(event, payload);
  }

  toTournament(tournamentId: string, event: string, payload: unknown): void {
    this.server?.to(rooms.tournament(tournamentId)).emit(event, payload);
  }

  toUser(userId: string, event: string, payload: unknown): void {
    this.server?.to(rooms.user(userId)).emit(event, payload);
  }
}
