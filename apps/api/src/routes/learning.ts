import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  applyUnlockRules,
  type EnrollmentDetail,
  type EnrollmentStatus,
  type SubmissionSummary,
} from '@internship/shared';
import { AppError } from '../errors.js';
import { requireParam } from '../params.js';

export interface LearningDeps {
  auth: RequestHandler;
  getEnrollmentDetail(userId: string, enrollmentId: string): Promise<EnrollmentDetail | null>;
  /** Resolves which of the caller's enrollments owns this lesson. */
  findEnrollmentForLesson(
    userId: string,
    lessonId: string,
  ): Promise<{ enrollmentId: string; detail: EnrollmentDetail } | null>;
  markLessonComplete(enrollmentId: string, lessonId: string): Promise<void>;
}

export function createLearningDeps(
  supabase: SupabaseClient,
  auth: RequestHandler,
): LearningDeps {
  async function build(
    enrollmentRow: {
      id: string;
      status: EnrollmentStatus;
      track_id: string;
    },
  ): Promise<EnrollmentDetail> {
    const [{ data: track }, { data: lessonRows }, { data: progressRows }, { data: projectRow }, { data: submissionRows }, { data: certRow }] =
      await Promise.all([
        supabase.from('tracks').select('slug, title').eq('id', enrollmentRow.track_id).maybeSingle(),
        supabase
          .from('lessons')
          .select('id, title, description, youtube_video_id, creator_name, duration_minutes, sort_order')
          .eq('track_id', enrollmentRow.track_id)
          .order('sort_order', { ascending: true }),
        supabase.from('lesson_progress').select('lesson_id').eq('enrollment_id', enrollmentRow.id),
        supabase
          .from('projects')
          .select('id, title, brief_markdown, requirements')
          .eq('track_id', enrollmentRow.track_id)
          .maybeSingle(),
        supabase
          .from('submissions')
          .select('id, github_url, live_url, notes, status, attempt_number, review_feedback, submitted_at, reviewed_at')
          .eq('enrollment_id', enrollmentRow.id)
          .order('attempt_number', { ascending: false }),
        supabase
          .from('certificates')
          .select('certificate_number')
          .eq('enrollment_id', enrollmentRow.id)
          .maybeSingle(),
      ]);

    const done = new Set(
      ((progressRows ?? []) as { lesson_id: string }[]).map((r) => r.lesson_id),
    );

    type LessonRow = {
      id: string;
      title: string;
      description: string;
      youtube_video_id: string;
      creator_name: string;
      duration_minutes: number;
      sort_order: number;
    };

    const lessons = applyUnlockRules(
      ((lessonRows ?? []) as LessonRow[]).map((row) => ({
        id: row.id,
        title: row.title,
        description: row.description,
        youtubeVideoId: row.youtube_video_id,
        creatorName: row.creator_name ?? '',
        durationMinutes: row.duration_minutes,
        sortOrder: row.sort_order,
        completed: done.has(row.id),
      })),
    );

    type SubRow = {
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

    const project = projectRow
      ? {
          id: (projectRow as { id: string }).id,
          title: (projectRow as { title: string }).title,
          briefMarkdown: (projectRow as { brief_markdown: string }).brief_markdown,
          requirements: (projectRow as { requirements: string }).requirements,
        }
      : null;

    return {
      id: enrollmentRow.id,
      status: enrollmentRow.status,
      trackId: enrollmentRow.track_id,
      trackSlug: (track as { slug: string } | null)?.slug ?? '',
      trackTitle: (track as { title: string } | null)?.title ?? '',
      lessons,
      project,
      projectUnlocked: lessons.length > 0 && lessons.every((l) => l.completed),
      submissions: ((submissionRows ?? []) as SubRow[]).map((r) => ({
        id: r.id,
        githubUrl: r.github_url,
        liveUrl: r.live_url,
        notes: r.notes,
        status: r.status,
        attemptNumber: r.attempt_number,
        reviewFeedback: r.review_feedback,
        submittedAt: r.submitted_at,
        reviewedAt: r.reviewed_at,
      })),
      certificateNumber:
        (certRow as { certificate_number: string } | null)?.certificate_number ?? null,
    };
  }

  return {
    auth,

    async getEnrollmentDetail(userId, enrollmentId) {
      const { data, error } = await supabase
        .from('enrollments')
        .select('id, status, track_id')
        .eq('id', enrollmentId)
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new AppError(500, 'enrollment_lookup_failed', error.message);
      if (!data) return null;
      return build(data as { id: string; status: EnrollmentStatus; track_id: string });
    },

    async findEnrollmentForLesson(userId, lessonId) {
      const { data: lesson, error } = await supabase
        .from('lessons')
        .select('track_id')
        .eq('id', lessonId)
        .maybeSingle();
      if (error) throw new AppError(500, 'lesson_lookup_failed', error.message);
      if (!lesson) return null;

      const { data: enrollment } = await supabase
        .from('enrollments')
        .select('id, status, track_id')
        .eq('user_id', userId)
        .eq('track_id', (lesson as { track_id: string }).track_id)
        .maybeSingle();
      if (!enrollment) return null;

      const row = enrollment as { id: string; status: EnrollmentStatus; track_id: string };
      return { enrollmentId: row.id, detail: await build(row) };
    },

    async markLessonComplete(enrollmentId, lessonId) {
      const { error } = await supabase
        .from('lesson_progress')
        .upsert(
          { enrollment_id: enrollmentId, lesson_id: lessonId },
          { onConflict: 'enrollment_id,lesson_id', ignoreDuplicates: true },
        );
      if (error) throw new AppError(500, 'progress_write_failed', error.message);
    },
  };
}

export function createLearningRouter(deps: LearningDeps): Router {
  const router = Router();

  router.get('/enrollments/:id', deps.auth, async (req, res, next) => {
    try {
      const detail = await deps.getEnrollmentDetail(req.auth!.id, requireParam(req, 'id'));
      if (!detail) throw new AppError(404, 'not_found', 'Enrollment not found');
      res.json(detail);
    } catch (err) {
      next(err);
    }
  });

  router.post('/lessons/:id/complete', deps.auth, async (req, res, next) => {
    try {
      const lessonId = requireParam(req, 'id');
      const found = await deps.findEnrollmentForLesson(req.auth!.id, lessonId);
      if (!found) throw new AppError(404, 'not_found', 'Lesson not found');

      // Paying for the track is what buys access. A pending or abandoned
      // payment must not be able to record progress.
      if (found.detail.status === 'pending_payment') {
        throw new AppError(403, 'enrollment_inactive', 'This track is not active yet');
      }

      const lesson = found.detail.lessons.find((l) => l.id === lessonId);
      if (!lesson) throw new AppError(404, 'not_found', 'Lesson not found');

      // Unlock state is recomputed from stored progress on every request, so
      // a crafted request cannot skip ahead by claiming a later lesson.
      if (!lesson.unlocked) {
        throw new AppError(403, 'lesson_locked', 'Finish the previous lesson first');
      }

      await deps.markLessonComplete(found.enrollmentId, lessonId);
      res.json({ completed: true, lessonId });
    } catch (err) {
      next(err);
    }
  });

  return router;
}
