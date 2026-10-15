import type { Request } from 'express';
import type { User, UserRole } from '../db/schema';

/** What we put inside the JWT. Kept minimal: the payload is signed, NOT encrypted, so anyone can read it. */
export interface JwtPayload {
  sub: string; // user id ("subject")
  role: UserRole;
}

/** The authenticated user attached to the request by JwtAuthGuard. */
export interface AuthUser {
  id: string;
  role: UserRole;
}

export type AuthedRequest = Request & { user?: AuthUser };

/** A user as the API exposes it: never includes the password hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
}

export const toPublicUser = (u: User): PublicUser => ({
  id: u.id,
  email: u.email,
  name: u.name,
  role: u.role,
});
