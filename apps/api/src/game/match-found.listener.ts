import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { Events, type MatchFoundEvent } from '../common/events';
import { GameBroadcaster } from './game.broadcaster';
import { MatchEngine } from './match-engine.service';

/**
 * Bridges matchmaking to the live game. When a pair is made:
 * - the engine starts tracking the match (arms the first-move abort timer even if
 *   nobody ever opens the board), and
 * - both players get `match:found` in their user room, on every open tab.
 * Matchmaking only emits the event; it never imports this module.
 */
@Injectable()
export class MatchFoundListener {
  private readonly logger = new Logger(MatchFoundListener.name);

  constructor(
    private readonly engine: MatchEngine,
    private readonly broadcaster: GameBroadcaster,
  ) {}

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
  }
}
