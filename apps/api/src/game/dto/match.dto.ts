import { IsIn, IsInt, IsOptional, IsUUID, Matches, Min } from 'class-validator';

const SQUARE = /^[a-h][1-8]$/;

/** tournament:watch, tournament:unwatch */
export class TournamentIdDto {
  @IsUUID()
  tournamentId: string;
}

/** match:join, match:leave, match:resign */
export class MatchIdDto {
  @IsUUID()
  matchId: string;
}

/**
 * match:move. The client sends intent only (from/to in UCI style, e.g. e2 -> e4);
 * the server works out SAN, legality and the resulting position.
 */
export class MoveDto {
  @IsUUID()
  matchId: string;

  @Matches(SQUARE, { message: 'from must be a square like e2' })
  from: string;

  @Matches(SQUARE, { message: 'to must be a square like e4' })
  to: string;

  @IsOptional()
  @IsIn(['q', 'r', 'b', 'n'])
  promotion?: 'q' | 'r' | 'b' | 'n';

  /** The ply this move would be (1 = White's first move). */
  @IsInt()
  @Min(1)
  ply: number;
}
