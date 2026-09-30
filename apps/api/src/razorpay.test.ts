import { describe, expect, it } from 'vitest';
import { createHmac } from 'node:crypto';
import { verifyWebhookSignature, verifyPaymentSignature } from './razorpay.js';

const SECRET = 'test_webhook_secret';

function sign(body: string, secret = SECRET) {
  return createHmac('sha256', secret).update(body).digest('hex');
}

describe('verifyWebhookSignature', () => {
  const body = JSON.stringify({ event: 'payment.captured', payload: { amount: 199900 } });

  it('accepts a correct signature', () => {
    expect(verifyWebhookSignature(body, sign(body), SECRET)).toBe(true);
  });

  it('accepts a Buffer body identically to a string body', () => {
    expect(verifyWebhookSignature(Buffer.from(body), sign(body), SECRET)).toBe(true);
  });

  it('rejects a tampered body', () => {
    const tampered = JSON.stringify({ event: 'payment.captured', payload: { amount: 100 } });
    expect(verifyWebhookSignature(tampered, sign(body), SECRET)).toBe(false);
  });

  it('rejects a signature made with a different secret', () => {
    expect(verifyWebhookSignature(body, sign(body, 'wrong_secret'), SECRET)).toBe(false);
  });

  it('rejects an empty signature without throwing', () => {
    expect(verifyWebhookSignature(body, '', SECRET)).toBe(false);
  });

  it('rejects a short signature without throwing', () => {
    expect(verifyWebhookSignature(body, 'deadbeef', SECRET)).toBe(false);
  });

  it('rejects a non-hex signature of the right length without throwing', () => {
    expect(verifyWebhookSignature(body, 'z'.repeat(64), SECRET)).toBe(false);
  });
});

describe('verifyPaymentSignature', () => {
  const orderId = 'order_ABC123';
  const paymentId = 'pay_XYZ789';
  const expected = sign(`${orderId}|${paymentId}`);

  it('accepts a correct signature', () => {
    expect(verifyPaymentSignature(orderId, paymentId, expected, SECRET)).toBe(true);
  });

  it('rejects when the order id is swapped', () => {
    expect(verifyPaymentSignature('order_OTHER', paymentId, expected, SECRET)).toBe(false);
  });

  it('rejects when the payment id is swapped', () => {
    expect(verifyPaymentSignature(orderId, 'pay_OTHER', expected, SECRET)).toBe(false);
  });
});
