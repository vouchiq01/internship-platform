import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { PaymentStatus } from '@internship/shared';
import { AppError } from '../errors.js';
import { verifyWebhookSignature } from '../razorpay.js';

export interface StoredPayment {
  id: string;
  userId: string;
  trackId: string;
  /** The amount we decided to charge, from our own records. */
  amountPaise: number;
  status: PaymentStatus;
}

export interface WebhookDeps {
  webhookSecret: string;
  findPaymentByOrderId(orderId: string): Promise<StoredPayment | null>;
  markPaid(paymentId: string, razorpayPaymentId: string): Promise<void>;
  markFailed(paymentId: string): Promise<void>;
  activateEnrollment(userId: string, trackId: string): Promise<void>;
  logAudit(action: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
}

interface PaymentEntity {
  id?: string;
  order_id?: string;
  amount?: number;
  currency?: string;
}

interface WebhookBody {
  event?: string;
  payload?: { payment?: { entity?: PaymentEntity } };
}

export function createWebhookDeps(
  supabase: SupabaseClient,
  webhookSecret: string,
): WebhookDeps {
  return {
    webhookSecret,

    async findPaymentByOrderId(orderId) {
      const { data, error } = await supabase
        .from('payments')
        .select('id, user_id, track_id, amount_paise, status')
        .eq('razorpay_order_id', orderId)
        .maybeSingle();
      if (error) throw new AppError(500, 'payment_lookup_failed', error.message);
      if (!data) return null;

      const row = data as {
        id: string;
        user_id: string;
        track_id: string;
        amount_paise: number;
        status: PaymentStatus;
      };
      return {
        id: row.id,
        userId: row.user_id,
        trackId: row.track_id,
        amountPaise: Number(row.amount_paise),
        status: row.status,
      };
    },

    async markPaid(paymentId, razorpayPaymentId) {
      const { error } = await supabase
        .from('payments')
        .update({
          status: 'paid',
          razorpay_payment_id: razorpayPaymentId,
          paid_at: new Date().toISOString(),
        })
        .eq('id', paymentId)
        // Only transition out of `created`. If a concurrent delivery already
        // moved it to `paid`, this updates nothing and stays idempotent.
        .eq('status', 'created');
      if (error) throw new AppError(500, 'payment_update_failed', error.message);
    },

    async markFailed(paymentId) {
      const { error } = await supabase
        .from('payments')
        .update({ status: 'failed' })
        .eq('id', paymentId)
        .eq('status', 'created');
      if (error) throw new AppError(500, 'payment_update_failed', error.message);
    },

    async activateEnrollment(userId, trackId) {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'active' })
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .eq('status', 'pending_payment');
      if (error) throw new AppError(500, 'enrollment_activate_failed', error.message);
    },

    async logAudit(action, entityId, metadata) {
      await supabase.from('audit_log').insert({
        action,
        entity_type: 'payment',
        entity_id: entityId,
        metadata,
      });
    },
  };
}

export function createWebhookRouter(deps: WebhookDeps): Router {
  const router = Router();

  router.post('/webhooks/razorpay', async (req, res, next) => {
    try {
      const signature = req.header('X-Razorpay-Signature') ?? '';
      // req.body is a Buffer here — this route is mounted with express.raw()
      // before express.json(), because the signature covers the exact bytes.
      const raw: Buffer | string = Buffer.isBuffer(req.body)
        ? req.body
        : typeof req.body === 'string'
          ? req.body
          : JSON.stringify(req.body ?? {});

      if (!verifyWebhookSignature(raw, signature, deps.webhookSecret)) {
        throw new AppError(400, 'invalid_signature', 'Signature verification failed');
      }

      let body: WebhookBody;
      try {
        body = JSON.parse(raw.toString()) as WebhookBody;
      } catch {
        throw new AppError(400, 'invalid_body', 'Body is not valid JSON');
      }

      const entity = body.payload?.payment?.entity;
      const orderId = entity?.order_id;

      // Events we do not handle are acknowledged so Razorpay stops retrying.
      if (body.event !== 'payment.captured' && body.event !== 'payment.failed') {
        res.json({ received: true, handled: false });
        return;
      }

      if (!orderId) {
        throw new AppError(400, 'invalid_body', 'Missing order id');
      }

      const payment = await deps.findPaymentByOrderId(orderId);
      if (!payment) {
        throw new AppError(404, 'unknown_order', 'No payment for this order');
      }

      if (body.event === 'payment.failed') {
        if (payment.status === 'created') await deps.markFailed(payment.id);
        res.json({ received: true, handled: true });
        return;
      }

      // Already processed. Return 200 so Razorpay stops retrying, and do NOT
      // activate a second time.
      if (payment.status === 'paid') {
        res.json({ received: true, handled: true, idempotent: true });
        return;
      }

      // Reconcile against our own record, never against the webhook alone.
      // A webhook claiming a smaller amount must not buy access.
      if (Number(entity?.amount) !== payment.amountPaise) {
        await deps.logAudit('payment.amount_mismatch', payment.id, {
          expected: payment.amountPaise,
          received: entity?.amount ?? null,
          orderId,
        });
        throw new AppError(
          400,
          'amount_mismatch',
          'Paid amount does not match the order',
        );
      }

      await deps.markPaid(payment.id, entity?.id ?? '');
      await deps.activateEnrollment(payment.userId, payment.trackId);
      await deps.logAudit('payment.captured', payment.id, {
        orderId,
        amountPaise: payment.amountPaise,
      });

      res.json({ received: true, handled: true });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
