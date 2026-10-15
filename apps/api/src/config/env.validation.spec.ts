import { validateEnv } from './env.validation';

const valid = {
  DATABASE_URL: 'postgres://u:p@localhost:5432/db',
  JWT_SECRET: 'a'.repeat(32),
};

describe('validateEnv', () => {
  it('applies defaults and converts types', () => {
    const env = validateEnv({ ...valid, API_PORT: '5000' });
    expect(env.API_PORT).toBe(5000);
    expect(env.NODE_ENV).toBe('development');
    expect(env.JWT_TTL_SECONDS).toBe(28800);
  });

  it('fails fast when a required variable is missing', () => {
    expect(() => validateEnv({ JWT_SECRET: valid.JWT_SECRET })).toThrow(
      /DATABASE_URL/,
    );
  });

  it('rejects a short JWT secret', () => {
    expect(() => validateEnv({ ...valid, JWT_SECRET: 'short' })).toThrow(
      /JWT_SECRET/,
    );
  });
});
