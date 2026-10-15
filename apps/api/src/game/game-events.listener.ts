import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import {
  Events,
  type MatchFoundEvent,
  type TournamentStatusChangedEvent,
} from '../common/events';
import { GameBroadcaster } from './game.broadcaster';
import { MatchEngine } from './match-engine.service';

/**
 * Turns in-process domain events into live game state and socket pushes.
 * The emitting modules (matchmaking, tournaments) never import this one.
 */
@Injectable()
export class GameEventsListener {
  private readonly logger = new Logger(GameEventsListener.name);

  constructor(
    private readonly engine: MatchEngine,
    private readonly broadcaster: GameBroadcaster,
  ) {}

  /**
   * A pair was made:
   * - the engine starts tracking the match (arms the first-move abort timer even if
   *   nobody ever opens the board),
   * - both players get `match:found` in their user room, on every open tab,
   * - tournament watchers refresh (the coach's "live games" count).
   */
  @OnEvent(Events.MatchFound)
  async onMatchFound(e: MatchFoundEvent): Promise<void> {
    try {
      await this.engine.track(e.matchId);
    } catch (err) {
      this.logger.error(`Could not start tracking match ${e.matchId}`, err);
    }
    for (const player of [e.white, e.black]) {
      this.broadcaster.toUser(player.id, 'match:found', e);
    }
    this.broadcaster.toTournament(e.tournamentId, 'tournament:updated', {
      tournamentId: e.tournamentId,
    });
  }

  /** Started / completed (winner declared): everyone on the tournament page refreshes. */
  @OnEvent(Events.TournamentStatusChanged)
  onStatusChanged(e: TournamentStatusChangedEvent): void {
    this.broadcaster.toTournament(e.tournamentId, 'tournament:updated', {
      tournamentId: e.tournamentId,
    });
  }
}
