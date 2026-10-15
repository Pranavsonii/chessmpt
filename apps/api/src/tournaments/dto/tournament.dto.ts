import { Transform } from 'class-transformer';
import {
  ArrayNotEmpty,
  IsArray,
  IsBoolean,
  IsIn,
  IsISO8601,
  IsOptional,
  IsString,
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

export class CreateTournamentDto {
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name: string;

  /** e.g. "5+0" */
  @IsTimeControl()
  timeControl: string;

  /** ISO 8601 with timezone, e.g. "2026-10-16T17:00:00+05:30". Stored as UTC. */
  @IsISO8601(
    { strict: true },
    { message: 'startsAt must be an ISO 8601 date-time' },
  )
  startsAt: string;
}

/** PATCH: every field optional. Rules about WHEN a field may change live in the service. */
export class UpdateTournamentDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(3)
  @MaxLength(120)
  name?: string;

  @IsOptional()
  @IsTimeControl()
  timeControl?: string;

  @IsOptional()
  @IsISO8601(
    { strict: true },
    { message: 'startsAt must be an ISO 8601 date-time' },
  )
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
