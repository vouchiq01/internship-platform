import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createEnrollmentSchema,
  type EnrollmentStatus,
  type EnrollmentWithTrack,
  type Track,
} from '@internship/shared';
import { AppError } from '../errors.js';
import type { RazorpayClient } from '../razorpay.js';
import { rowToTrack } from './tracks.js';

export interface ExistingEnrollment {
  id: string;
  status: EnrollmentStatus;
  razorpayOrderId: string | null;
}

export interface EnrollmentsDeps {
  auth: RequestHandler;
  razorpayKeyId: string;
  razorpay: RazorpayClient;
  getTrackById(id: string): Promise<Track | null>;
  findEnrollment(userId: string, trackId: string): Promise<ExistingEnrollment | null>;
  createPendingEnrollment(args: {
    userId: string;
    trackId: string;
    orderId: string;
    amountPaise: number;
  }): Promise<{ enrollmentId: string; orderId: string }>;
  listEnrollments(userId: string): Promise<EnrollmentWithTrack[]>;
}

export function createEnrollmentsDeps(
  supabase: SupabaseClient,
  razorpay: RazorpayClient,
  razorpayKeyId: string,
  auth: RequestHandler,
): EnrollmentsDeps {
  return {
    auth,
    razorpayKeyId,
    razorpay,

    async getTrackById(id) {
      const { data, error } = await supabase
        .from('tracks')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new AppError(500, 'track_lookup_failed', error.message);
      return data ? rowToTrack(data as Parameters<typeof rowToTrack>[0]) : null;
    },

    async findEnrollment(userId, trackId) {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, status')
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .maybeSingle();
      if (error) throw new AppError(500, 'enrollment_lookup_failed', error.message);
      if (!data) return null;

      const { data: payment } = await supabase
        .from('payments')
        .select('razorpay_order_id')
        .eq('user_id', userId)
        .eq('track_id', trackId)
        .eq('status', 'created')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      return {
        id: (data as { id: string }).id,
        status: (data as { status: EnrollmentStatus }).status,
        razorpayOrderId:
          (payment as { razorpay_order_id: string } | null)?.razorpay_order_id ?? null,
      };
    },

    async createPendingEnrollment({ userId, trackId, orderId, amountPaise }) {
      const { error: payErr } = await supabase.from('payments').insert({
        user_id: userId,
        track_id: trackId,
        razorpay_order_id: orderId,
        amount_paise: amountPaise,
        currency: 'INR',
        status: 'created',
      });
      if (payErr) throw new AppError(500, 'payment_create_failed', payErr.message);

      const { data, error } = await supabase
        .from('enrollments')
        .upsert(
          { user_id: userId, track_id: trackId, status: 'pending_payment' },
          { onConflict: 'user_id,track_id' },
        )
        .select('id')
        .single();
      if (error) throw new AppError(500, 'enrollment_create_failed', error.message);

      return { enrollmentId: (data as { id: string }).id, orderId };
    },

    async listEnrollments(userId) {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, user_id, track_id, status, enrolled_at, completed_at, tracks(title, slug)')
        .eq('user_id', userId)
        .order('enrolled_at', { ascending: false });
      if (error) throw new AppError(500, 'enrollment_list_failed', error.message);

      type Row = {
        id: string;
        user_id: string;
        track_id: string;
        status: EnrollmentStatus;
        enrolled_at: string;
        completed_at: string | null;
        tracks: { title: string; slug: string } | null;
      };

      return ((data ?? []) as Row[]).map((row) => ({
        id: row.id,
        userId: row.user_id,
        trackId: row.track_id,
        status: row.status,
        enrolledAt: row.enrolled_at,
        completedAt: row.completed_at,
        trackTitle: row.tracks?.title ?? '',
        trackSlug: row.tracks?.slug ?? '',
        lessonsTotal: 0,
        lessonsCompleted: 0,
      }));
    },
  };
}

export function createEnrollmentsRouter(deps: EnrollmentsDeps): Router {
  const router = Router();

  router.get('/enrollments', deps.auth, async (req, res, next) => {
    try {
      res.json(await deps.listEnrollments(req.auth!.id));
    } catch (err) {
      next(err);
    }
  });

  router.post('/enrollments', deps.auth, async (req, res, next) => {
    try {
      const parsed = createEnrollmentSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(400, 'validation_failed', 'A valid trackId is required');
      }

      const userId = req.auth!.id;
      const { trackId } = parsed.data;

      const track = await deps.getTrackById(trackId);
      if (!track || !track.isPublished) {
        throw new AppError(404, 'not_found', 'Track not found');
      }

      const existing = await deps.findEnrollment(userId, trackId);
      if (existing?.status === 'active' || existing?.status === 'completed') {
        throw new AppError(409, 'already_enrolled', 'You are already enrolled in this track');
      }

      // The price comes from the track row. Anything the client sent about
      // price or amount was stripped by the schema above and is not read here.
      const amountPaise = track.priceInr * 100;

      // A pending payment already has an order. Reuse it rather than leaving
      // orphaned Razorpay orders behind every time the student reloads.
      if (existing?.status === 'pending_payment' && existing.razorpayOrderId) {
        res.status(200).json({
          enrollmentId: existing.id,
          orderId: existing.razorpayOrderId,
          amountPaise,
          currency: 'INR',
          keyId: deps.razorpayKeyId,
        });
        return;
      }

      const order = await deps.razorpay.createOrder({
        amountPaise,
        currency: 'INR',
        receipt: `enr_${userId.slice(0, 8)}_${trackId.slice(0, 8)}`,
        notes: { userId, trackId, trackSlug: track.slug },
      });

      const created = await deps.createPendingEnrollment({
        userId,
        trackId,
        orderId: order.id,
        amountPaise,
      });

      res.status(201).json({
        enrollmentId: created.enrollmentId,
        orderId: created.orderId,
        amountPaise,
        currency: 'INR',
        keyId: deps.razorpayKeyId,
      });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
