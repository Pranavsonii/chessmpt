// Runs before any test file is imported, so ConfigModule's validation sees these.
// Only fills gaps: real values from .env still win.
process.env.NODE_ENV ??= 'test';
process.env.DATABASE_URL ??= 'postgres://chess:chess@localhost:5433/chess';
process.env.JWT_SECRET ??= 'test-secret-'.padEnd(40, 'x');
