import { IsUUID } from 'class-validator';

export class MatchJoinDto {
  @IsUUID()
  matchId: string;
}
