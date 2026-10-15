import {
  BadRequestException,
  ValidationError,
  ValidationPipe,
} from '@nestjs/common';

export interface FieldError {
  field: string;
  errors: string[];
}

/** Flattens class-validator errors (including nested DTOs) into [{ field, errors }]. */
export function flattenValidationErrors(
  errors: ValidationError[],
  parent = '',
): FieldError[] {
  return errors.flatMap((e) => {
    const field = parent ? `${parent}.${e.property}` : e.property;
    const own: FieldError[] = e.constraints
      ? [{ field, errors: Object.values(e.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(e.children ?? [], field)];
  });
}

/**
 * Global validation for every REST input (body, query, params).
 * - whitelist:            strips properties that have no decorator in the DTO
 * - forbidNonWhitelisted: ...and rejects the request instead of silently stripping
 *                         (blocks mass-assignment like sending { role: 'coach' })
 * - transform:            turns the plain JSON into a DTO instance and converts types
 */
export function buildValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    exceptionFactory: (errors) =>
      new BadRequestException({
        code: 'VALIDATION_ERROR',
        message: 'Request validation failed',
        details: flattenValidationErrors(errors),
      }),
  });
}
