import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateBy,
  ValidationOptions,
} from 'class-validator';
import { tournamentStatus, type TournamentStatus } from '../../db/schema';
import { parseTimeControl } from '../domain/time-control';

const STATUSES = tournamentStatus.enumValues;

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

/** Custom validator: reuses the domain parser so the rules live in one place. */
function IsTimeControl(options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isTimeControl',
      validator: {
        validate: (value: unknown) =>
          typeof value === 'string' && parseTimeControl(value) !== null,
        defaultMessage: () =>
          'timeControl must look like "5+0": 1–180 minutes, plus a 0–60 second increment',
      },
    },
    options,
  );
}

/**
 * Letters (any language, with their combining marks, e.g. Hindi vowel signs),
 * digits, spaces and everyday punctuation. Allow-listing keeps quotes, brackets,
 * angle brackets and control characters out: the name is written into every game's
 * PGN header ([Event "..."]), where a `"`, `]` or newline would corrupt the file.
 */
export const TOURNAMENT_NAME_PATTERN = /^[\p{L}\p{M}\p{N} .,'&()!?:#+/-]+$/u;
const NAME_MESSAGE =
  "name may only contain letters, numbers, spaces and . , ' & ( ) ! ? : # + / -";

/** Tolerate small clock differences between the coach's browser and the server. */
const PAST_TOLERANCE_MS = 60 * 60_000;
const ONE_YEAR_MS = 366 * 24 * 60 * 60_000;

/** An ISO date no earlier than now - `pastMs` (if given) and no later than a year from now. */
function IsDateInWindow(pastMs: number | null, options?: ValidationOptions) {
  return ValidateBy(
    {
      name: 'isDateInWindow',
      validator: {
        validate: (value: unknown) => {
          if (typeof value !== 'string') return false;
          const t = new Date(value).getTime();
          if (Number.isNaN(t)) return false;
          const now = Date.now();
          return (
            (pastMs === null || t >= now - pastMs) && t <= now + ONE_YEAR_MS
          );
        },
        defaultMessage: () =>
          pastMs === null
            ? 'startsAt must be within the next year'
            : 'startsAt must be in the future and within the next year',
      },
    },
    options,
  );
}

const ISO_MESSAGE = { message: 'startsAt must be an ISO 8601 date-time' };

export class CreateTournamentDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(TOURNAMENT_NAME_PATTERN, { message: NAME_MESSAGE })
  name: string;

  /** e.g. "5+0" */
  @IsTimeControl()
  timeControl: string;

  /** ISO 8601 with timezone, e.g. "2026-10-16T17:00:00+05:30". Stored as UTC. */
  @IsISO8601({ strict: true }, ISO_MESSAGE)
  @IsDateInWindow(PAST_TOLERANCE_MS)
  startsAt: string;
}

/** PATCH: every field optional. Rules about WHEN a field may change live in the service. */
export class UpdateTournamentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  @Matches(TOURNAMENT_NAME_PATTERN, { message: NAME_MESSAGE })
  name?: string;

  @IsOptional()
  @IsTimeControl()
  timeControl?: string;

  /** No lower bound: an ongoing tournament's start time is legitimately in the past. */
  @IsOptional()
  @IsISO8601({ strict: true }, ISO_MESSAGE)
  @IsDateInWindow(null)
  startsAt?: string;
}

export class UpdateStatusDto {
  @IsIn(STATUSES, { message: `status must be one of: ${STATUSES.join(', ')}` })
  status: TournamentStatus;
}

/** GET /tournaments?status=open,ongoing */
export class ListTournamentsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean)
      : value,
  )
  @IsArray()
  @ArrayNotEmpty()
  @IsIn(STATUSES, {
    each: true,
    message: `status must be among: ${STATUSES.join(', ')}`,
  })
  status?: TournamentStatus[];

  /** Students only: ?joined=true lists just the tournaments they joined. */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean({ message: 'joined must be true or false' })
  joined?: boolean;
}
