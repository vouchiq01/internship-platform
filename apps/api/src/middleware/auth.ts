import type { RequestHandler } from 'express';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { UserRole } from '@internship/shared';
import { AppError } from '../errors.js';
import type { Config } from '../config.js';

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthUser;
    }
  }
}

export interface AuthDeps {
  verifyToken(token: string): Promise<{ sub: string; email?: string }>;
  loadRole(userId: string): Promise<UserRole | null>;
}

/** Production wiring: verify against the project's JWKS, read role from profiles. */
export function createAuthDeps(config: Config, supabase: SupabaseClient): AuthDeps {
  const jwks = createRemoteJWKSet(
    new URL(`${config.supabaseUrl}/auth/v1/.well-known/jwks.json`),
  );

  return {
    async verifyToken(token) {
      const { payload } = await jwtVerify(token, jwks, {
        issuer: `${config.supabaseUrl}/auth/v1`,
      });
      return {
        sub: payload.sub as string,
        email: payload.email as string | undefined,
      };
    },
    async loadRole(userId) {
      const { data, error } = await supabase
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle();
      if (error) throw new AppError(500, 'profile_lookup_failed', error.message);
      return (data?.role as UserRole | undefined) ?? null;
    },
  };
}

export function createAuthMiddleware(deps: AuthDeps): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw new AppError(401, 'unauthenticated', 'Missing bearer token');
      }

      const token = header.slice('Bearer '.length).trim();

      let claims: { sub: string; email?: string };
      try {
        claims = await deps.verifyToken(token);
      } catch {
        // Deliberately opaque: never tell a caller *why* their token failed.
        throw new AppError(401, 'unauthenticated', 'Invalid or expired token');
      }

      if (!claims.sub) {
        throw new AppError(401, 'unauthenticated', 'Token has no subject');
      }

      // The app role comes from the database, NEVER from the token. The token's
      // own `role` claim is the Postgres role and is not an authorisation grant.
      const role = await deps.loadRole(claims.sub);
      if (!role) {
        throw new AppError(401, 'profile_not_found', 'No profile for this user');
      }

      req.auth = { id: claims.sub, email: claims.email ?? '', role };
      next();
    } catch (err) {
      next(err);
    }
  };
}

export const requireAdmin: RequestHandler = (req, _res, next) => {
  if (req.auth?.role !== 'admin') {
    next(new AppError(403, 'forbidden', 'Admin access required'));
    return;
  }
  next();
};
