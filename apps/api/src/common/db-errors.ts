/** Postgres error code for "duplicate key value violates unique constraint". */
const UNIQUE_VIOLATION = '23505';

/**
 * True if a query failed because a unique / primary key constraint rejected it.
 * Drizzle wraps the driver error, so look at both the error and its `cause`.
 */
export function isUniqueViolation(err: unknown): boolean {
  const codeOf = (e: unknown) =>
    typeof e === 'object' && e !== null && 'code' in e ? e.code : undefined;
  return (
    codeOf(err) === UNIQUE_VIOLATION ||
    codeOf((err as { cause?: unknown } | null)?.cause) === UNIQUE_VIOLATION
  );
}
