import {
  ExecutionContext,
  ForbiddenException,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { UserRole } from '../../db/schema';
import type { AuthUser } from '../auth.types';
import { RolesGuard } from './roles.guard';

function contextWith(user: AuthUser | undefined): ExecutionContext {
  return {
    getType: () => 'http',
    getHandler: () => () => undefined,
    getClass: () => class {},
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  } as unknown as ExecutionContext;
}

function guardRequiring(roles: UserRole[] | undefined) {
  const reflector = new Reflector();
  jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(roles);
  return new RolesGuard(reflector);
}

const coach: AuthUser = { id: 'c1', role: 'coach' };
const student: AuthUser = { id: 's1', role: 'student' };

describe('RolesGuard', () => {
  it('allows any logged-in user when no @Roles() is set', () => {
    expect(guardRequiring(undefined).canActivate(contextWith(student))).toBe(
      true,
    );
  });

  it('allows a coach on a coach-only route', () => {
    expect(guardRequiring(['coach']).canActivate(contextWith(coach))).toBe(
      true,
    );
  });

  it('forbids a student on a coach-only route (403)', () => {
    expect(() =>
      guardRequiring(['coach']).canActivate(contextWith(student)),
    ).toThrow(ForbiddenException);
  });

  it('forbids a coach on a student-only route (403)', () => {
    expect(() =>
      guardRequiring(['student']).canActivate(contextWith(coach)),
    ).toThrow(ForbiddenException);
  });

  it('allows either role when both are listed', () => {
    const guard = guardRequiring(['coach', 'student']);
    expect(guard.canActivate(contextWith(coach))).toBe(true);
    expect(guard.canActivate(contextWith(student))).toBe(true);
  });

  it('401s if no user is attached', () => {
    expect(() =>
      guardRequiring(['coach']).canActivate(contextWith(undefined)),
    ).toThrow(UnauthorizedException);
  });
});
