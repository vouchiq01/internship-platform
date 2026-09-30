import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { Track } from '@internship/shared';
import { createEnrollmentsRouter, type EnrollmentsDeps } from './enrollments.js';
import { AppError, errorHandler } from '../errors.js';

const TRACK_ID = '11111111-1111-4111-8111-111111111111';
const USER_ID = '99999999-9999-4999-8999-999999999999';

const track: Track = {
  id: TRACK_ID,
  slug: 'development',
  title: 'Development',
  description: '',
  priceInr: 1999,
  listPriceInr: 6000,
  durationWeeks: 8,
  thumbnailUrl: null,
  isPublished: true,
  sortOrder: 0,
};

const authed: RequestHandler = (req, _res, next) => {
  req.auth = { id: USER_ID, email: 'student@example.com', role: 'student' };
  next();
};

const anon: RequestHandler = (_req, _res, next) => {
  next(new AppError(401, 'unauthenticated', 'Missing bearer token'));
};

function buildApp(overrides: Partial<EnrollmentsDeps> = {}, auth: RequestHandler = authed) {
  const createOrder = vi.fn(async () => ({ id: 'order_TEST123' }));
  const createPending = vi.fn(async () => ({ enrollmentId: 'e1', orderId: 'order_TEST123' }));

  const deps: EnrollmentsDeps = {
    auth,
    razorpayKeyId: 'rzp_test_key',
    razorpay: { createOrder },
    getTrackById: async (id) => (id === TRACK_ID ? track : null),
    findEnrollment: async () => null,
    createPendingEnrollment: createPending,
    listEnrollments: async () => [],
    ...overrides,
  };

  const app = express();
  app.use(express.json());
  app.use('/api', createEnrollmentsRouter(deps));
  app.use(errorHandler);
  return { app, createOrder, createPending };
}

describe('POST /api/enrollments', () => {
  it('rejects an unauthenticated caller', async () => {
    const { app } = buildApp({}, anon);
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.status).toBe(401);
  });

  it('rejects a malformed track id', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/enrollments').send({ trackId: 'development' });
    expect(res.status).toBe(400);
  });

  it('404s an unknown track', async () => {
    const { app } = buildApp();
    const res = await request(app)
      .post('/api/enrollments')
      .send({ trackId: '22222222-2222-4222-8222-222222222222' });
    expect(res.status).toBe(404);
  });

  it('404s an unpublished track', async () => {
    const { app } = buildApp({ getTrackById: async () => ({ ...track, isPublished: false }) });
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.status).toBe(404);
  });

  it('charges the track price, ignoring any amount in the request body', async () => {
    const { app, createOrder } = buildApp();
    const res = await request(app)
      .post('/api/enrollments')
      .send({ trackId: TRACK_ID, priceInr: 1, amountPaise: 100, amount: 1 });

    expect(res.status).toBe(201);
    expect(createOrder).toHaveBeenCalledTimes(1);
    // 1999 rupees -> 199900 paise. NOT the 100 the client asked for.
    expect(createOrder.mock.calls[0]?.[0]).toMatchObject({
      amountPaise: 199900,
      currency: 'INR',
    });
    expect(res.body.amountPaise).toBe(199900);
  });

  it('returns the public key id but never the secret', async () => {
    const { app } = buildApp();
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.body.keyId).toBe('rzp_test_key');
    expect(JSON.stringify(res.body)).not.toContain('secret');
  });

  it('refuses a second enrollment when already active', async () => {
    const { app, createOrder } = buildApp({
      findEnrollment: async () => ({ id: 'e1', status: 'active', razorpayOrderId: 'order_OLD' }),
    });
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.status).toBe(409);
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('reuses the existing order when a payment is still pending', async () => {
    const { app, createOrder } = buildApp({
      findEnrollment: async () => ({
        id: 'e-pending',
        status: 'pending_payment',
        razorpayOrderId: 'order_PENDING',
      }),
    });
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.status).toBe(200);
    expect(res.body.orderId).toBe('order_PENDING');
    expect(createOrder).not.toHaveBeenCalled();
  });

  it('refuses re-enrolment on a completed track', async () => {
    const { app } = buildApp({
      findEnrollment: async () => ({ id: 'e1', status: 'completed', razorpayOrderId: 'order_OLD' }),
    });
    const res = await request(app).post('/api/enrollments').send({ trackId: TRACK_ID });
    expect(res.status).toBe(409);
  });
});
