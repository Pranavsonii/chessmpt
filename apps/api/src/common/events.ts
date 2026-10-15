import type { TournamentStatus } from '../db/schema';

/**
 * In-process domain events (via @nestjs/event-emitter).
 *
 * Modules announce what happened instead of calling each other directly. For example,
 * matchmaking emits MatchFound and the Socket.IO gateway (Phase 7) listens and pushes
 * `match:found` to both players. Neither module imports the other, which also avoids
 * a circular dependency (the gateway calls matchmaking when a player disconnects).
 */
export const Events = {
  MatchFound: 'match.found',
  TournamentStatusChanged: 'tournament.status_changed',
} as const;

export interface PlayerRef {
  id: string;
  name: string;
}

export interface MatchFoundEvent {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  white: PlayerRef;
  black: PlayerRef;
}

export interface TournamentStatusChangedEvent {
  tournamentId: string;
  from: TournamentStatus;
  to: TournamentStatus;
}
