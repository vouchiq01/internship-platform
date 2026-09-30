import { describe, expect, it } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { Profile } from '@internship/shared';
import { createMeRouter } from './me.js';
import { errorHandler } from '../errors.js';

const profile: Profile = {
  id: 'user-1',
  email: 'student@example.com',
  fullName: 'Asha Kumar',
  phone: null,
  college: null,
  graduationYear: null,
  role: 'student',
  createdAt: '2026-09-30T10:00:00.000Z',
};

const fakeAuth: RequestHandler = (req, _res, next) => {
  req.auth = { id: 'user-1', email: profile.email, role: 'student' };
  next();
};

function buildApp(store: Profile | null = profile) {
  let current = store;
  const app = express();
  app.use(express.json());
  app.use(
    '/api',
    createMeRouter({
      auth: fakeAuth,
      getProfile: async () => current,
      updateProfile: async (_id, input) => {
        if (!current) throw new Error('no profile');
        current = { ...current, ...input };
        return current;
      },
    }),
  );
  app.use(errorHandler);
  return app;
}

describe('GET /api/me', () => {
  it('returns the caller profile', async () => {
    const res = await request(buildApp()).get('/api/me');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(profile);
  });

  it('returns 404 when the profile is missing', async () => {
    const res = await request(buildApp(null)).get('/api/me');
    expect(res.status).toBe(404);
  });
});

describe('PATCH /api/me', () => {
  it('updates allowed fields', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ college: 'NIT Trichy', graduationYear: 2027 });
    expect(res.status).toBe(200);
    expect(res.body.college).toBe('NIT Trichy');
    expect(res.body.graduationYear).toBe(2027);
  });

  it('silently ignores an attempt to self-assign admin', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ fullName: 'Asha K', role: 'admin' });
    expect(res.status).toBe(200);
    expect(res.body.role).toBe('student');
  });

  it('rejects an invalid graduation year', async () => {
    const res = await request(buildApp())
      .patch('/api/me')
      .send({ graduationYear: 1899 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('validation_failed');
  });
});
