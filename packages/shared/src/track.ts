import { z } from 'zod';

export const trackSchema = z.object({
  id: z.string().uuid(),
  slug: z.string().min(1),
  title: z.string().min(1),
  description: z.string(),
  /** Rupees, not paise. The charged amount is priceInr * 100. */
  priceInr: z.number().int().nonnegative(),
  /** Display-only anchor price. Never used to compute a charge. */
  listPriceInr: z.number().int().positive().nullable(),
  durationWeeks: z.number().int().positive(),
  thumbnailUrl: z.string().nullable(),
  isPublished: z.boolean(),
  sortOrder: z.number().int(),
});

export type Track = z.infer<typeof trackSchema>;

export const lessonSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  description: z.string(),
  youtubeVideoId: z.string(),
  durationMinutes: z.number().int().nonnegative(),
  sortOrder: z.number().int(),
});

export type LessonSummary = z.infer<typeof lessonSummarySchema>;

export const projectSummarySchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  briefMarkdown: z.string(),
  requirements: z.string(),
});

export type ProjectSummary = z.infer<typeof projectSummarySchema>;

export const trackDetailSchema = trackSchema.extend({
  lessons: z.array(lessonSummarySchema),
  project: projectSummarySchema.nullable(),
});

export type TrackDetail = z.infer<typeof trackDetailSchema>;

/**
 * The entire enrolment request. A track id and nothing else.
 * Any price the client sends is stripped here — the server reads the price
 * from the tracks table so a tampered body cannot change what is charged.
 */
export const createEnrollmentSchema = z.object({
  trackId: z.string().uuid(),
});

export type CreateEnrollmentInput = z.infer<typeof createEnrollmentSchema>;

export const createOrderResponseSchema = z.object({
  enrollmentId: z.string().uuid(),
  orderId: z.string(),
  amountPaise: z.number().int().positive(),
  currency: z.string(),
  /** Razorpay's public key id. Safe to send to the browser. */
  keyId: z.string(),
});

export type CreateOrderResponse = z.infer<typeof createOrderResponseSchema>;
