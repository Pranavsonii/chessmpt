import { IsUUID } from 'class-validator';

/** tournament:watch, tournament:unwatch */
export class TournamentIdDto {
  @IsUUID()
  tournamentId: string;
}
