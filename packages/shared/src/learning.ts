import { z } from 'zod';
import { enrollmentStatusSchema, submissionStatusSchema } from './enums.js';
import { lessonSummarySchema, projectSummarySchema } from './track.js';

/** A lesson as the student sees it inside a track they are enrolled in. */
export const enrolledLessonSchema = lessonSummarySchema.extend({
  completed: z.boolean(),
  /** False until every earlier lesson is complete. Enforced server-side. */
  unlocked: z.boolean(),
});

export type EnrolledLesson = z.infer<typeof enrolledLessonSchema>;

export const submissionSummarySchema = z.object({
  id: z.string().uuid(),
  githubUrl: z.string(),
  liveUrl: z.string().nullable(),
  notes: z.string(),
  status: submissionStatusSchema,
  attemptNumber: z.number().int().positive(),
  reviewFeedback: z.string().nullable(),
  submittedAt: z.string().datetime(),
  reviewedAt: z.string().datetime().nullable(),
});

export type SubmissionSummary = z.infer<typeof submissionSummarySchema>;

/** Everything the lesson player and project page need, in one response. */
export const enrollmentDetailSchema = z.object({
  id: z.string().uuid(),
  status: enrollmentStatusSchema,
  trackId: z.string().uuid(),
  trackSlug: z.string(),
  trackTitle: z.string(),
  lessons: z.array(enrolledLessonSchema),
  project: projectSummarySchema.nullable(),
  /** True only when every lesson is complete — gates project submission. */
  projectUnlocked: z.boolean(),
  submissions: z.array(submissionSummarySchema),
  certificateNumber: z.string().nullable(),
});

export type EnrollmentDetail = z.infer<typeof enrollmentDetailSchema>;

/**
 * Computes unlock state for a lesson list. Lesson 0 is always unlocked; every
 * later lesson unlocks only when the one before it is complete.
 *
 * Exported and pure so it can be tested directly and reused by the API and
 * the UI without the two drifting apart.
 */
export function applyUnlockRules(
  lessons: Array<Omit<EnrolledLesson, 'unlocked'>>,
): EnrolledLesson[] {
  let previousComplete = true;
  return lessons.map((lesson) => {
    const unlocked = previousComplete;
    previousComplete = lesson.completed;
    return { ...lesson, unlocked };
  });
}
