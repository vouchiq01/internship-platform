import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { createHmac } from 'node:crypto';
import { createWebhookRouter, type WebhookDeps } from './webhooks.js';
import { errorHandler } from '../errors.js';

const SECRET = 'test_webhook_secret';
const ORDER_ID = 'order_TEST123';

function sign(body: string) {
  return createHmac('sha256', SECRET).update(body).digest('hex');
}

function captured(orderId = ORDER_ID, amount = 199900) {
  return JSON.stringify({
    event: 'payment.captured',
    payload: {
      payment: {
        entity: {
          id: 'pay_TEST999',
          order_id: orderId,
          amount,
          currency: 'INR',
          status: 'captured',
        },
      },
    },
  });
}

function failed(orderId = ORDER_ID) {
  return JSON.stringify({
    event: 'payment.failed',
    payload: {
      payment: {
        entity: { id: 'pay_FAIL', order_id: orderId, amount: 199900, currency: 'INR' },
      },
    },
  });
}

function buildApp(overrides: Partial<WebhookDeps> = {}) {
  const markPaid = vi.fn(async () => {});
  const markFailed = vi.fn(async () => {});
  const activate = vi.fn(async () => {});
  const logAudit = vi.fn(async () => {});

  let paymentStatus = 'created';

  const deps: WebhookDeps = {
    webhookSecret: SECRET,
    findPaymentByOrderId: async (orderId) =>
      orderId === ORDER_ID
        ? { id: 'p1', userId: 'u1', trackId: 't1', amountPaise: 199900, status: paymentStatus as never }
        : null,
    markPaid: async (...args) => {
      paymentStatus = 'paid';
      await markPaid(...(args as []));
    },
    markFailed,
    activateEnrollment: activate,
    logAudit,
    ...overrides,
  };

  const app = express();
  // Mounted with a raw parser BEFORE express.json(), exactly as in app.ts.
  app.use('/api', express.raw({ type: 'application/json' }), createWebhookRouter(deps));
  app.use(express.json());
  app.use(errorHandler);
  return { app, markPaid, markFailed, activate, logAudit };
}

function post(app: express.Express, body: string, signature?: string) {
  const req = request(app)
    .post('/api/webhooks/razorpay')
    .set('Content-Type', 'application/json');
  if (signature !== undefined) req.set('X-Razorpay-Signature', signature);
  return req.send(body);
}

describe('POST /api/webhooks/razorpay', () => {
  it('rejects a request with no signature header', async () => {
    const { app, activate } = buildApp();
    const res = await post(app, captured());
    expect(res.status).toBe(400);
    expect(activate).not.toHaveBeenCalled();
  });

  it('rejects an invalid signature', async () => {
    const { app, activate } = buildApp();
    const res = await post(app, captured(), 'a'.repeat(64));
    expect(res.status).toBe(400);
    expect(activate).not.toHaveBeenCalled();
  });

  it('rejects a body tampered after signing', async () => {
    const { app, activate } = buildApp();
    const signature = sign(captured(ORDER_ID, 199900));
    const res = await post(app, captured(ORDER_ID, 100), signature);
    expect(res.status).toBe(400);
    expect(activate).not.toHaveBeenCalled();
  });

  it('404s an order it does not know', async () => {
    const { app, activate } = buildApp();
    const body = captured('order_UNKNOWN');
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(404);
    expect(activate).not.toHaveBeenCalled();
  });

  it('REFUSES to activate when the amount does not match the stored payment', async () => {
    const { app, activate, markPaid } = buildApp();
    const body = captured(ORDER_ID, 100); // paid 1 rupee, owed 1999
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('amount_mismatch');
    expect(activate).not.toHaveBeenCalled();
    expect(markPaid).not.toHaveBeenCalled();
  });

  it('activates the enrollment on a valid captured payment', async () => {
    const { app, activate, markPaid } = buildApp();
    const body = captured();
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(200);
    expect(markPaid).toHaveBeenCalledTimes(1);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('is idempotent — a replayed webhook activates exactly once', async () => {
    const { app, activate } = buildApp();
    const body = captured();
    const signature = sign(body);

    const first = await post(app, body, signature);
    const second = await post(app, body, signature);
    const third = await post(app, body, signature);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200); // 200 so Razorpay stops retrying
    expect(third.status).toBe(200);
    expect(activate).toHaveBeenCalledTimes(1);
  });

  it('marks a failed payment without activating anything', async () => {
    const { app, activate, markFailed } = buildApp();
    const body = failed();
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(200);
    expect(markFailed).toHaveBeenCalledTimes(1);
    expect(activate).not.toHaveBeenCalled();
  });

  it('acknowledges an event it does not handle without activating', async () => {
    const { app, activate } = buildApp();
    const body = JSON.stringify({ event: 'refund.created', payload: {} });
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(200);
    expect(activate).not.toHaveBeenCalled();
  });

  it('rejects a signed body that is not valid JSON', async () => {
    const { app, activate } = buildApp();
    const body = 'not json at all';
    const res = await post(app, body, sign(body));
    expect(res.status).toBe(400);
    expect(activate).not.toHaveBeenCalled();
  });
});
