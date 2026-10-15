import 'reflect-metadata'; // decorators below need it, even outside the Nest runtime (e.g. unit tests)
import { plainToInstance } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsString,
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

  @IsString()
  @IsNotEmpty()
  WEB_ORIGIN: string = 'http://localhost:3000';
}

export function validateEnv(
  config: Record<string, unknown>,
): EnvironmentVariables {
  const env = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true, // "4000" -> 4000
  });
  const errors = validateSync(env, { skipMissingProperties: false });
  if (errors.length > 0) {
    const messages = errors
      .flatMap((e) => Object.values(e.constraints ?? {}))
      .join('\n  - ');
    throw new Error(`Invalid environment configuration:\n  - ${messages}`);
  }
  return env;
}
