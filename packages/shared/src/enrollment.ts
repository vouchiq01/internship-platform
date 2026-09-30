import { z } from 'zod';
import { enrollmentStatusSchema } from './enums.js';

export const enrollmentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  trackId: z.string().uuid(),
  status: enrollmentStatusSchema,
  enrolledAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
});

export type Enrollment = z.infer<typeof enrollmentSchema>;

/** An enrollment joined with the track it belongs to, for the dashboard. */
export const enrollmentWithTrackSchema = enrollmentSchema.extend({
  trackTitle: z.string(),
  trackSlug: z.string(),
  lessonsTotal: z.number().int().nonnegative(),
  lessonsCompleted: z.number().int().nonnegative(),
});

export type EnrollmentWithTrack = z.infer<typeof enrollmentWithTrackSchema>;
