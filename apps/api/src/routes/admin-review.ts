import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  reviewSubmissionSchema,
  type ReviewQueueItem,
  type SubmissionStatus,
} from '@internship/shared';
import { AppError } from '../errors.js';
import { requireParam } from '../params.js';

export interface AdminReviewDeps {
  auth: RequestHandler;
  requireAdmin: RequestHandler;
  listPending(): Promise<ReviewQueueItem[]>;
  getSubmission(id: string): Promise<{ status: SubmissionStatus; enrollmentId: string } | null>;
  applyReview(
    submissionId: string,
    reviewerId: string,
    status: 'approved' | 'rejected',
    feedback: string,
  ): Promise<void>;
  logAudit(action: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
  /**
   * Called after a submission is approved. Issues the certificate.
   * Separate from applyReview so a failure here leaves the approval recorded
   * and the issue retryable, rather than silently losing the review.
   */
  onApproved(enrollmentId: string): Promise<{ certificateNumber: string } | null>;
}

export function createAdminReviewDeps(
  supabase: SupabaseClient,
  auth: RequestHandler,
  requireAdmin: RequestHandler,
  onApproved: AdminReviewDeps['onApproved'],
): AdminReviewDeps {
  return {
    auth,
    requireAdmin,
    onApproved,

    async listPending() {
      const { data, error } = await supabase
        .from('submissions')
        .select(
          `id, enrollment_id, github_url, live_url, notes, attempt_number, submitted_at,
           projects(title),
           enrollments(profiles(full_name, email), tracks(title))`,
        )
        .eq('status', 'pending')
        .order('submitted_at', { ascending: true });
      if (error) throw new AppError(500, 'queue_load_failed', error.message);

      const first = <T>(v: T | T[] | null | undefined): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

      type Row = {
        id: string;
        enrollment_id: string;
        github_url: string;
        live_url: string | null;
        notes: string;
        attempt_number: number;
        submitted_at: string;
        projects: { title: string } | { title: string }[] | null;
        enrollments:
          | {
              profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
              tracks: { title: string } | { title: string }[] | null;
            }
          | null;
      };

      return ((data ?? []) as unknown as Row[]).map((row) => {
        const enrollment = first(row.enrollments);
        const profile = first(enrollment?.profiles);
        const track = first(enrollment?.tracks);
        return {
          id: row.id,
          enrollmentId: row.enrollment_id,
          studentName: profile?.full_name || profile?.email || 'Unknown',
          studentEmail: profile?.email ?? '',
          trackTitle: track?.title ?? '',
          projectTitle: first(row.projects)?.title ?? '',
          githubUrl: row.github_url,
          liveUrl: row.live_url,
          notes: row.notes,
          attemptNumber: row.attempt_number,
          submittedAt: row.submitted_at,
        };
      });
    },

    async getSubmission(id) {
      const { data, error } = await supabase
        .from('submissions')
        .select('status, enrollment_id')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new AppError(500, 'submission_lookup_failed', error.message);
      if (!data) return null;
      const row = data as { status: SubmissionStatus; enrollment_id: string };
      return { status: row.status, enrollmentId: row.enrollment_id };
    },

    async applyReview(submissionId, reviewerId, status, feedback) {
      const { error } = await supabase
        .from('submissions')
        .update({
          status,
          reviewer_id: reviewerId,
          review_feedback: feedback || null,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', submissionId)
        // Only a pending submission can be reviewed. If a concurrent reviewer
        // got there first, this updates nothing rather than overwriting them.
        .eq('status', 'pending');
      if (error) throw new AppError(500, 'review_write_failed', error.message);
    },

    async logAudit(action, entityId, metadata) {
      await supabase.from('audit_log').insert({
        action,
        entity_type: 'submission',
        entity_id: entityId,
        metadata,
      });
    },
  };
}

export function createAdminReviewRouter(deps: AdminReviewDeps): Router {
  const router = Router();

  router.get('/submissions', deps.auth, deps.requireAdmin, async (_req, res, next) => {
    try {
      res.json(await deps.listPending());
    } catch (err) {
      next(err);
    }
  });

  router.post(
    '/submissions/:id/review',
    deps.auth,
    deps.requireAdmin,
    async (req, res, next) => {
      try {
        const submissionId = requireParam(req, 'id');

        const parsed = reviewSubmissionSchema.safeParse(req.body);
        if (!parsed.success) {
          throw new AppError(
            400,
            'validation_failed',
            parsed.error.issues[0]?.message ?? 'Invalid review',
          );
        }

        const current = await deps.getSubmission(submissionId);
        if (!current) throw new AppError(404, 'not_found', 'Submission not found');
        if (current.status !== 'pending') {
          throw new AppError(409, 'already_reviewed', 'This submission was already reviewed');
        }

        const status = parsed.data.decision === 'approve' ? 'approved' : 'rejected';
        await deps.applyReview(submissionId, req.auth!.id, status, parsed.data.feedback);
        await deps.logAudit(`submission.${status}`, submissionId, {
          reviewerId: req.auth!.id,
          hasFeedback: parsed.data.feedback.length > 0,
        });

        let certificateNumber: string | null = null;
        if (status === 'approved') {
          const issued = await deps.onApproved(current.enrollmentId);
          certificateNumber = issued?.certificateNumber ?? null;
        }

        res.json({ id: submissionId, status, certificateNumber });
      } catch (err) {
        next(err);
      }
    },
  );

  return router;
}
