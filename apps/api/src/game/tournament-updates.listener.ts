import { Injectable } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Events,
  type MatchFoundEvent,
  type TournamentStatusChangedEvent,
} from '../common/events';
import { GameBroadcaster } from './game.broadcaster';

/**
 * Keeps open tournament pages fresh. Anyone watching `tournament:{id}` gets a
 * `tournament:updated` nudge and refetches over REST; the event carries no data,
 * so the HTTP endpoints stay the single source of truth.
 *
 * Sent when the status changes and when a game starts (live games count).
 * MatchEngine sends it itself when a game ends (the leaderboard changes).
 */
@Injectable()
export class TournamentUpdatesListener {
  constructor(private readonly broadcaster: GameBroadcaster) {}

  @OnEvent(Events.TournamentStatusChanged)
  onStatusChanged(e: TournamentStatusChangedEvent): void {
    this.broadcaster.toTournament(e.tournamentId, 'tournament:updated', {
      tournamentId: e.tournamentId,
      status: e.to,
    });
  }

  @OnEvent(Events.MatchFound)
  onMatchFound(e: MatchFoundEvent): void {
    this.broadcaster.toTournament(e.tournamentId, 'tournament:updated', {
      tournamentId: e.tournamentId,
    });
  }
}
