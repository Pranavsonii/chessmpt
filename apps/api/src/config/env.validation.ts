import 'reflect-metadata'; // decorators below need it, even outside the Nest runtime (e.g. unit tests)
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  validateSync,
} from 'class-validator';

export enum NodeEnv {
  Development = 'development',
  Production = 'production',
  Test = 'test',
}

/**
 * Every environment variable the API needs. The app refuses to boot
 * if one is missing or malformed (fail fast instead of failing at runtime).
 */
export class EnvironmentVariables {
  @IsEnum(NodeEnv)
  NODE_ENV: NodeEnv = NodeEnv.Development;

  @IsInt()
  @Min(1)
  @Max(65535)
  API_PORT: number = 4000;

  @IsString()
  @IsNotEmpty()
  DATABASE_URL: string;

  @IsString()
  @MinLength(32, { message: 'JWT_SECRET must be at least 32 characters' })
  JWT_SECRET: string;

  /** Lifetime of the JWT and of the cookie that carries it (default 8 hours). */
  @IsInt()
  @Min(60)
  JWT_TTL_SECONDS: number = 8 * 60 * 60;

  /** Exact browser origin (scheme + host + port, no path): CORS and the socket Origin check compare against it. */
  @IsUrl(
    {
      require_tld: false,
      require_protocol: true,
      protocols: ['http', 'https'],
    },
    { message: 'WEB_ORIGIN must be an origin like http://localhost:3000' },
  )
  WEB_ORIGIN: string = 'http://localhost:3000';
}

/** The value shipped in .env.example. Long enough to pass @MinLength, so check it explicitly. */
export const EXAMPLE_JWT_SECRET =
  'change-me-to-a-long-random-string-at-least-32-chars';

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "4000" -> 4000
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  const messages = errors.flatMap((e) => Object.values(e.constraints ?? {}));

  // Anyone who has read the repo knows the example secret, and with it can forge a
  // coach token. Refuse to start a production server with it.
  if (
    env.NODE_ENV === NodeEnv.Production &&
    env.JWT_SECRET === EXAMPLE_JWT_SECRET
  ) {
    messages.push(
      'JWT_SECRET is still the example value from .env.example; generate a real one',
    );
  }

  if (messages.length > 0) {
    throw new Error(
      `Invalid environment configuration:\n  - ${messages.join('\n  - ')}`,
    );
  }
  return env;
}
