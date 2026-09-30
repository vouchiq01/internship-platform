import { z } from 'zod';

/**
 * Extracts a YouTube video id from whatever an admin pastes.
 *
 * Admins paste watch URLs, share links, embeds, and sometimes a bare id — all
 * with timestamps, playlist ids and tracking parameters attached. Storing the
 * id rather than the URL means normalising once here instead of parsing on
 * every page render.
 *
 * Returns null when nothing usable is present, so the caller can reject it
 * rather than silently storing rubbish.
 */
export function extractYouTubeId(input: string): string | null {
  const value = input.trim();
  if (value === '') return null;

  // A bare id: exactly 11 characters of the YouTube alphabet.
  if (/^[A-Za-z0-9_-]{11}$/.test(value)) return value;

  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return null;
  }

  const host = url.hostname.replace(/^www\./, '').replace(/^m\./, '');
  const isYouTube =
    host === 'youtube.com' ||
    host === 'youtube-nocookie.com' ||
    host === 'youtu.be';
  if (!isYouTube) return null;

  const candidates: Array<string | null> = [];

  if (host === 'youtu.be') {
    candidates.push(url.pathname.split('/').filter(Boolean)[0] ?? null);
  } else {
    candidates.push(url.searchParams.get('v'));
    const segments = url.pathname.split('/').filter(Boolean);
    const [first, second] = segments;
    if (first === 'embed' || first === 'shorts' || first === 'live' || first === 'v') {
      candidates.push(second ?? null);
    }
  }

  for (const candidate of candidates) {
    if (candidate && /^[A-Za-z0-9_-]{11}$/.test(candidate)) return candidate;
  }
  return null;
}

const youtubeIdSchema = z
  .string()
  .transform((v, ctx) => {
    const id = extractYouTubeId(v);
    if (!id) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Paste a YouTube link or an 11-character video id',
      });
      return z.NEVER;
    }
    return id;
  });

export const upsertTrackSchema = z.object({
  slug: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, 'Use lower-case words separated by hyphens'),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(2000).default(''),
  priceInr: z.number().int().min(0).max(1_000_000),
  listPriceInr: z.number().int().positive().max(1_000_000).nullable().optional(),
  durationWeeks: z.number().int().min(1).max(104),
  isPublished: z.boolean().default(false),
  sortOrder: z.number().int().min(0).max(999).default(0),
});

export type UpsertTrackInput = z.infer<typeof upsertTrackSchema>;

export const upsertLessonSchema = z.object({
  trackId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(1000).default(''),
  youtubeVideoId: youtubeIdSchema,
  durationMinutes: z.number().int().min(0).max(600).default(0),
  sortOrder: z.number().int().min(0).max(999),
});

export type UpsertLessonInput = z.infer<typeof upsertLessonSchema>;

export const reorderLessonsSchema = z.object({
  trackId: z.string().uuid(),
  /** Lesson ids in their new order. Position in the array is the sort order. */
  lessonIds: z.array(z.string().uuid()).min(1).max(200),
});

export type ReorderLessonsInput = z.infer<typeof reorderLessonsSchema>;

export const upsertProjectSchema = z.object({
  trackId: z.string().uuid(),
  title: z.string().trim().min(1).max(200),
  briefMarkdown: z.string().max(10_000).default(''),
  requirements: z.string().max(5000).default(''),
});

export type UpsertProjectInput = z.infer<typeof upsertProjectSchema>;

export const adminStudentSchema = z.object({
  id: z.string().uuid(),
  fullName: z.string(),
  email: z.string(),
  college: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  createdAt: z.string().datetime(),
  enrollmentCount: z.number().int().nonnegative(),
  completedCount: z.number().int().nonnegative(),
  totalPaidPaise: z.number().int().nonnegative(),
});

export type AdminStudent = z.infer<typeof adminStudentSchema>;

export const reportsSummarySchema = z.object({
  revenuePaise: z.number().int().nonnegative(),
  activeEnrollments: z.number().int().nonnegative(),
  completedEnrollments: z.number().int().nonnegative(),
  pendingReviews: z.number().int().nonnegative(),
  completionRatePct: z.number().min(0).max(100),
  enrollmentsByTrack: z.array(
    z.object({ trackTitle: z.string(), trackSlug: z.string(), count: z.number().int().nonnegative() }),
  ),
  enrollmentsByMonth: z.array(
    z.object({ month: z.string(), count: z.number().int().nonnegative() }),
  ),
});

export type ReportsSummary = z.infer<typeof reportsSummarySchema>;

export interface RawEnrollment {
  status: 'pending_payment' | 'active' | 'completed';
  enrolledAt: string;
  trackSlug: string;
  trackTitle: string;
}

/**
 * Pure aggregation for the reports dashboard. Kept out of the query layer so
 * the arithmetic — especially the completion rate — can be tested directly.
 */
export function summariseReports(args: {
  enrollments: RawEnrollment[];
  paidAmountsPaise: number[];
  pendingReviews: number;
}): ReportsSummary {
  const { enrollments, paidAmountsPaise, pendingReviews } = args;

  const revenuePaise = paidAmountsPaise.reduce((sum, n) => sum + n, 0);
  const active = enrollments.filter((e) => e.status === 'active').length;
  const completed = enrollments.filter((e) => e.status === 'completed').length;

  // Denominator is everyone who actually paid — pending_payment enrollments
  // never started, so counting them would understate the rate.
  const started = active + completed;
  const completionRatePct =
    started === 0 ? 0 : Math.round((completed / started) * 1000) / 10;

  const byTrack = new Map<string, { trackTitle: string; trackSlug: string; count: number }>();
  for (const e of enrollments) {
    const entry = byTrack.get(e.trackSlug) ?? {
      trackTitle: e.trackTitle,
      trackSlug: e.trackSlug,
      count: 0,
    };
    entry.count += 1;
    byTrack.set(e.trackSlug, entry);
  }

  const byMonth = new Map<string, number>();
  for (const e of enrollments) {
    const month = e.enrolledAt.slice(0, 7); // YYYY-MM
    byMonth.set(month, (byMonth.get(month) ?? 0) + 1);
  }

  return {
    revenuePaise,
    activeEnrollments: active,
    completedEnrollments: completed,
    pendingReviews,
    completionRatePct,
    enrollmentsByTrack: [...byTrack.values()].sort((a, b) => b.count - a.count),
    enrollmentsByMonth: [...byMonth.entries()]
      .map(([month, count]) => ({ month, count }))
      .sort((a, b) => a.month.localeCompare(b.month)),
  };
}
