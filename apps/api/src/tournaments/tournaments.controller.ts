import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import type { AuthUser } from '../auth/auth.types';
import { CurrentUser, Roles } from '../auth/decorators';
import {
  CreateTournamentDto,
  ListTournamentsQueryDto,
  UpdateStatusDto,
  UpdateTournamentDto,
} from './dto/tournament.dto';
import { TournamentsService } from './tournaments.service';

/**
 * /api/v1/tournaments
 * Reads: both roles (students never see drafts). Writes: coach only.
 */
@Controller('tournaments')
export class TournamentsController {
  constructor(private readonly tournaments: TournamentsService) {}

  @Get()
  list(@CurrentUser() user: AuthUser, @Query() query: ListTournamentsQueryDto) {
    return this.tournaments.list(user, query.status, query.joined);
  }

  /** POST /api/v1/tournaments/:id/join → 201 with the tournament (isJoined: true). */
  @Roles('student')
  @Post(':id/join')
  join(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string) {
    return this.tournaments.join(user, id);
  }

  @Get(':id')
  findOne(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tournaments.findOne(user, id);
  }

  @Get(':id/participants')
  participants(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tournaments.participants(user, id);
  }

  /** Both roles (same visibility as the tournament itself). */
  @Get(':id/leaderboard')
  leaderboard(
    @CurrentUser() user: AuthUser,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.tournaments.leaderboard(user, id);
  }

  /** Per-game results for the coach's stats page. */
  @Roles('coach')
  @Get(':id/matches')
  results(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournaments.results(id);
  }

  @Roles('coach')
  @Post()
  create(@CurrentUser() user: AuthUser, @Body() dto: CreateTournamentDto) {
    return this.tournaments.create(user.id, dto); // 201 by default for POST
  }

  @Roles('coach')
  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateTournamentDto,
  ) {
    return this.tournaments.update(id, dto);
  }

  @Roles('coach')
  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStatusDto,
  ) {
    return this.tournaments.changeStatus(id, dto.status);
  }

  @Roles('coach')
  @Delete(':id')
  @HttpCode(204)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.tournaments.remove(id);
  }
}
