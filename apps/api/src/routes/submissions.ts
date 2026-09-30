import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  createSubmissionSchema,
  type EnrollmentDetail,
  type SubmissionSummary,
} from '@internship/shared';
import { AppError } from '../errors.js';

export interface CreateSubmissionArgs {
  enrollmentId: string;
  projectId: string;
  githubUrl: string;
  liveUrl: string | null;
  notes: string;
  attemptNumber: number;
}

export interface SubmissionsDeps {
  auth: RequestHandler;
  getEnrollmentDetail(userId: string, enrollmentId: string): Promise<EnrollmentDetail | null>;
  createSubmission(args: CreateSubmissionArgs): Promise<SubmissionSummary>;
}

export function createSubmissionsDeps(
  supabase: SupabaseClient,
  getEnrollmentDetail: SubmissionsDeps['getEnrollmentDetail'],
  auth: RequestHandler,
): SubmissionsDeps {
  return {
    auth,
    getEnrollmentDetail,
    async createSubmission(args) {
      const { data, error } = await supabase
        .from('submissions')
        .insert({
          enrollment_id: args.enrollmentId,
          project_id: args.projectId,
          github_url: args.githubUrl,
          live_url: args.liveUrl,
          notes: args.notes,
          attempt_number: args.attemptNumber,
          status: 'pending',
        })
        .select(
          'id, github_url, live_url, notes, status, attempt_number, review_feedback, submitted_at, reviewed_at',
        )
        .single();
      if (error) throw new AppError(500, 'submission_write_failed', error.message);

      const row = data as {
        id: string;
        github_url: string;
        live_url: string | null;
        notes: string;
        status: SubmissionSummary['status'];
        attempt_number: number;
        review_feedback: string | null;
        submitted_at: string;
        reviewed_at: string | null;
      };

      return {
        id: row.id,
        githubUrl: row.github_url,
        liveUrl: row.live_url,
        notes: row.notes,
        status: row.status,
        attemptNumber: row.attempt_number,
        reviewFeedback: row.review_feedback,
        submittedAt: row.submitted_at,
        reviewedAt: row.reviewed_at,
      };
    },
  };
}

export function createSubmissionsRouter(deps: SubmissionsDeps): Router {
  const router = Router();

  router.post('/submissions', deps.auth, async (req, res, next) => {
    try {
      const parsed = createSubmissionSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'validation_failed',
          parsed.error.issues[0]?.message ?? 'Invalid submission',
        );
      }

      const { enrollmentId, githubUrl, liveUrl, notes } = parsed.data;

      const detail = await deps.getEnrollmentDetail(req.auth!.id, enrollmentId);
      if (!detail) throw new AppError(404, 'not_found', 'Enrollment not found');

      if (detail.status === 'pending_payment') {
        throw new AppError(403, 'enrollment_inactive', 'This track is not active yet');
      }

      if (!detail.project) {
        throw new AppError(404, 'not_found', 'This track has no project');
      }

      // Both gates are checked here, not just hidden in the UI.
      if (!detail.projectUnlocked) {
        throw new AppError(403, 'project_locked', 'Finish every lesson first');
      }

      // `submissions` arrives ordered by attempt_number descending.
      const latest = detail.submissions[0];

      if (latest?.status === 'approved') {
        throw new AppError(409, 'already_approved', 'Your project has already been approved');
      }
      if (latest?.status === 'pending') {
        throw new AppError(409, 'review_pending', 'Your last submission is still being reviewed');
      }

      const attemptNumber = (latest?.attemptNumber ?? 0) + 1;

      const created = await deps.createSubmission({
        enrollmentId,
        projectId: detail.project.id,
        githubUrl,
        liveUrl: liveUrl ?? null,
        notes,
        attemptNumber,
      });

      res.status(201).json(created);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
