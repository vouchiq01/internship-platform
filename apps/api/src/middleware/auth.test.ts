import { describe, expect, it, beforeAll } from 'vitest';
import express from 'express';
import request from 'supertest';
import { SignJWT, exportJWK, generateKeyPair, jwtVerify, createLocalJWKSet } from 'jose';
import type { UserRole } from '@internship/shared';
import { createAuthMiddleware, requireAdmin } from './auth.js';
import { errorHandler } from '../errors.js';

let signToken: (sub: string, expSeconds?: number) => Promise<string>;
let verifyToken: (token: string) => Promise<{ sub: string; email?: string }>;

beforeAll(async () => {
  const { publicKey, privateKey } = await generateKeyPair('RS256');
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'RS256' };
  const jwks = createLocalJWKSet({ keys: [jwk] });

  signToken = (sub, expSeconds = 3600) =>
    new SignJWT({ email: `${sub}@example.com`, role: 'authenticated' })
      .setProtectedHeader({ alg: 'RS256', kid: 'test-key' })
      .setSubject(sub)
      .setIssuedAt()
      .setExpirationTime(Math.floor(Date.now() / 1000) + expSeconds)
      .sign(privateKey);

  verifyToken = async (token) => {
    const { payload } = await jwtVerify(token, jwks);
    return { sub: payload.sub as string, email: payload.email as string | undefined };
  };
});

function buildApp(roles: Record<string, UserRole>) {
  const app = express();
  const auth = createAuthMiddleware({
    verifyToken,
    loadRole: async (userId) => roles[userId] ?? null,
  });
  app.get('/whoami', auth, (req, res) => { res.json(req.auth); });
  app.get('/admin-only', auth, requireAdmin, (_req, res) => { res.json({ ok: true }); });
  app.use(errorHandler);
  return app;
}

describe('createAuthMiddleware', () => {
  it('rejects a request with no Authorization header', async () => {
    const res = await request(buildApp({})).get('/whoami');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('unauthenticated');
  });

  it('rejects a malformed Authorization header', async () => {
    const res = await request(buildApp({}))
      .get('/whoami')
      .set('Authorization', 'Basic abc123');
    expect(res.status).toBe(401);
  });

  it('rejects a token with a bad signature', async () => {
    const token = await signToken('user-1');
    const tampered = `${token.slice(0, -4)}AAAA`;
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${tampered}`);
    expect(res.status).toBe(401);
  });

  it('rejects an expired token', async () => {
    const token = await signToken('user-1', -60);
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });

  it('rejects a valid token with no matching profile', async () => {
    const token = await signToken('ghost');
    const res = await request(buildApp({}))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('profile_not_found');
  });

  it('attaches the user on a valid token', async () => {
    const token = await signToken('user-1');
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/whoami')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      id: 'user-1',
      email: 'user-1@example.com',
      role: 'student',
    });
  });
});

describe('requireAdmin', () => {
  it('rejects a student', async () => {
    const token = await signToken('user-1');
    const res = await request(buildApp({ 'user-1': 'student' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });

  it('allows an admin', async () => {
    const token = await signToken('boss');
    const res = await request(buildApp({ boss: 'admin' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('ignores a forged app role in the token body', async () => {
    // The token claims role=authenticated (a Postgres role). The app role must
    // come from the profiles table, never from the token.
    const token = await signToken('sneaky');
    const res = await request(buildApp({ sneaky: 'student' }))
      .get('/admin-only')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });
});
