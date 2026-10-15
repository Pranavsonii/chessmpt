import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import bcrypt from 'bcryptjs';
import type { Database } from '../db/client';
import type { User } from '../db/schema';
import { AuthService } from './auth.service';

const SECRET = 'unit-test-secret-that-is-long-enough!!';

const student: User = {
  id: '11111111-1111-1111-1111-111111111111',
  email: 'aarav@koc.test',
  passwordHash: bcrypt.hashSync('Student@123', 4), // low cost: tests stay fast
  name: 'Aarav Sharma',
  role: 'student',
  createdAt: new Date(),
};

function setup(found: User | undefined) {
  const findFirst = jest.fn().mockResolvedValue(found);
  const db = { query: { users: { findFirst } } } as unknown as Database;
  const jwt = new JwtService({
    secret: SECRET,
    signOptions: { algorithm: 'HS256', expiresIn: 3600 },
    verifyOptions: { algorithms: ['HS256'] },
  });
  return { service: new AuthService(db, jwt), jwt, findFirst };
}

async function expectInvalidCredentials(p: Promise<unknown>) {
  await expect(p).rejects.toBeInstanceOf(UnauthorizedException);
  await expect(p).rejects.toMatchObject({
    response: { code: 'INVALID_CREDENTIALS' },
  });
}

describe('AuthService.login', () => {
  it('returns the public user and a token for correct credentials', async () => {
    const { service } = setup(student);
    const { user, token } = await service.login(
      'aarav@koc.test',
      'Student@123',
    );

    expect(user).toEqual({
      id: student.id,
      email: student.email,
      name: student.name,
      role: 'student',
    });
    expect(user).not.toHaveProperty('passwordHash');
    expect(token.split('.')).toHaveLength(3); // header.payload.signature
  });

  it('rejects a wrong password', async () => {
    const { service } = setup(student);
    await expectInvalidCredentials(service.login('aarav@koc.test', 'nope123'));
  });

  it('rejects an unknown email with the SAME error (no user enumeration)', async () => {
    const { service } = setup(undefined);
    await expectInvalidCredentials(
      service.login('ghost@koc.test', 'Student@123'),
    );
  });
});

describe('AuthService.verifyToken', () => {
  it('accepts a token it signed', async () => {
    const { service } = setup(student);
    const { token } = await service.login('aarav@koc.test', 'Student@123');
    expect(service.verifyToken(token)).toEqual({
      id: student.id,
      role: 'student',
    });
  });

  it('rejects a token whose payload was edited (e.g. role -> coach)', async () => {
    const { service } = setup(student);
    const { token } = await service.login('aarav@koc.test', 'Student@123');
    const [header, , signature] = token.split('.');
    const forgedPayload = Buffer.from(
      JSON.stringify({ sub: student.id, role: 'coach' }),
    ).toString('base64url');
    expect(
      service.verifyToken(`${header}.${forgedPayload}.${signature}`),
    ).toBeNull();
  });

  it('rejects a token signed with another secret', () => {
    const { service } = setup(student);
    const other = new JwtService({
      secret: 'some-other-secret-value-0123456789',
    });
    expect(
      service.verifyToken(other.sign({ sub: student.id, role: 'coach' })),
    ).toBeNull();
  });

  it('rejects an expired token', () => {
    const { service } = setup(student);
    // Same secret, but no default expiresIn, so we can set an `exp` 10s in the past.
    const signer = new JwtService({ secret: SECRET });
    const expired = signer.sign({
      sub: student.id,
      role: 'student',
      exp: Math.floor(Date.now() / 1000) - 10,
    });
    expect(service.verifyToken(expired)).toBeNull();
  });

  it('rejects an unsigned "alg: none" token', () => {
    const { service } = setup(student);
    const b64 = (o: object) =>
      Buffer.from(JSON.stringify(o)).toString('base64url');
    const unsigned = `${b64({ alg: 'none', typ: 'JWT' })}.${b64({ sub: student.id, role: 'coach' })}.`;
    expect(service.verifyToken(unsigned)).toBeNull();
  });

  it('rejects a validly signed token with an unknown role', () => {
    const { service, jwt } = setup(student);
    expect(
      service.verifyToken(jwt.sign({ sub: student.id, role: 'admin' })),
    ).toBeNull();
  });

  it('rejects garbage', () => {
    const { service } = setup(student);
    expect(service.verifyToken('not-a-jwt')).toBeNull();
  });
});
