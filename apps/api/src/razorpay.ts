import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppError } from './errors.js';
import type { Config } from './config.js';

/**
 * Constant-time comparison of two hex digests.
 *
 * The length guard runs first because timingSafeEqual throws on mismatched
 * lengths, and a thrown error in a signature check is an availability bug.
 * A plain `===` here would leak the digest a byte at a time under timing
 * analysis, which is why this is not simply `a === b`.
 */
function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  const bufA = Buffer.from(a, 'hex');
  const bufB = Buffer.from(b, 'hex');
  // Buffer.from silently drops invalid hex, so a non-hex string of the right
  // character length still produces a short buffer. Check again after decoding.
  if (bufA.length !== bufB.length || bufA.length === 0) return false;
  return timingSafeEqual(bufA, bufB);
}

/** Verifies the X-Razorpay-Signature header against the RAW request body. */
export function verifyWebhookSignature(
  rawBody: Buffer | string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  return safeEqualHex(expected, signature);
}

/** Verifies the signature returned by Razorpay Checkout in the browser. */
export function verifyPaymentSignature(
  orderId: string,
  paymentId: string,
  signature: string,
  secret: string,
): boolean {
  if (!signature) return false;
  const expected = createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
  return safeEqualHex(expected, signature);
}

export interface CreateOrderArgs {
  amountPaise: number;
  currency: string;
  receipt: string;
  notes?: Record<string, string>;
}

export interface RazorpayClient {
  createOrder(args: CreateOrderArgs): Promise<{ id: string }>;
}

const RAZORPAY_ORDERS_URL = 'https://api.razorpay.com/v1/orders';

export function createRazorpayClient(config: Config): RazorpayClient {
  const auth = Buffer.from(
    `${config.razorpayKeyId}:${config.razorpayKeySecret}`,
  ).toString('base64');

  return {
    async createOrder({ amountPaise, currency, receipt, notes }) {
      const res = await fetch(RAZORPAY_ORDERS_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${auth}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ amount: amountPaise, currency, receipt, notes }),
      });

      if (!res.ok) {
        const detail = await res.text().catch(() => '');
        throw new AppError(
          502,
          'razorpay_order_failed',
          `Razorpay rejected the order (${res.status})${detail ? `: ${detail.slice(0, 200)}` : ''}`,
        );
      }

      const body = (await res.json()) as { id?: string };
      if (!body.id) {
        throw new AppError(502, 'razorpay_order_failed', 'Razorpay returned no order id');
      }
      return { id: body.id };
    },
  };
}
