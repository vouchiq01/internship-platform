import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createVerifyRouter, type VerifyDeps } from './verify.js';
import { errorHandler } from '../errors.js';

const NUM = 'INTX-2026-DEV-00042';

function buildApp(over: Partial<VerifyDeps> = {}) {
  const lookup = vi.fn(async (n: string) =>
    n === NUM
      ? {
          certificateNumber: NUM,
          studentName: 'Asha Kumar',
          trackTitle: 'Development',
          issuedAt: '2026-09-30T10:00:00.000Z',
          revoked: false,
        }
      : null,
  );
  const deps: VerifyDeps = { lookup, ...over };
  const app = express();
  app.use('/api', createVerifyRouter(deps));
  app.use(errorHandler);
  return { app, lookup };
}

describe('GET /api/verify/:number', () => {
  it('returns the certificate for a valid number', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/api/verify/${NUM}`);
    expect(res.status).toBe(200);
    expect(res.body.studentName).toBe('Asha Kumar');
    expect(res.body.revoked).toBe(false);
  });

  it('accepts a lower-case number', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/verify/intx-2026-dev-00042');
    expect(res.status).toBe(200);
  });

  it('404s an unknown but well-formed number', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/verify/INTX-2026-DEV-99999');
    expect(res.status).toBe(404);
  });

  it('rejects a malformed number WITHOUT hitting the database', async () => {
    const { app, lookup } = buildApp();
    const res = await request(app).get('/api/verify/nonsense');
    expect(res.status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects an injection attempt without hitting the database', async () => {
    const { app, lookup } = buildApp();
    const res = await request(app).get(`/api/verify/${encodeURIComponent("INTX-2026-DEV-00042' OR 1=1--")}`);
    expect(res.status).toBe(400);
    expect(lookup).not.toHaveBeenCalled();
  });

  it('shows a revoked certificate as revoked rather than 404', async () => {
    const { app } = buildApp({
      lookup: async () => ({
        certificateNumber: NUM,
        studentName: 'Asha Kumar',
        trackTitle: 'Development',
        issuedAt: '2026-09-30T10:00:00.000Z',
        revoked: true,
      }),
    });
    const res = await request(app).get(`/api/verify/${NUM}`);
    expect(res.status).toBe(200);
    expect(res.body.revoked).toBe(true);
  });

  it('never exposes an email or internal id', async () => {
    const { app } = buildApp();
    const res = await request(app).get(`/api/verify/${NUM}`);
    const body = JSON.stringify(res.body);
    expect(body).not.toContain('@');
    expect(body).not.toContain('enrollmentId');
    expect(Object.keys(res.body).sort()).toEqual(
      ['certificateNumber', 'issuedAt', 'revoked', 'studentName', 'trackTitle'],
    );
  });
});
