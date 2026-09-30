import { z } from 'zod';

/**
 * Accepts a GitHub repository URL and nothing else.
 *
 * Reviewers open this link by hand, so a bare hostname check is not enough —
 * `github.com.evil.test` and `github.com@evil.test` both contain "github.com"
 * but resolve elsewhere. Parsing with URL and comparing the hostname exactly
 * is what makes this safe.
 */
export const githubRepoUrlSchema = z
  .string()
  .trim()
  .min(1, 'A GitHub repository URL is required')
  .max(300)
  .superRefine((value, ctx) => {
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That is not a valid URL' });
      return;
    }

    if (url.protocol !== 'https:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The URL must start with https://' });
      return;
    }

    if (url.hostname !== 'github.com' && url.hostname !== 'www.github.com') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That is not a github.com URL' });
      return;
    }

    // Expect /owner/repo — at least two non-empty path segments.
    const segments = url.pathname.split('/').filter(Boolean);
    if (segments.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Link the repository itself, e.g. https://github.com/you/project',
      });
    }
  });

export const optionalHttpsUrlSchema = z
  .string()
  .trim()
  .max(300)
  .superRefine((value, ctx) => {
    if (value === '') return;
    let url: URL;
    try {
      url = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'That is not a valid URL' });
      return;
    }
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'The URL must be http or https' });
    }
  })
  .transform((v) => (v === '' ? null : v))
  .nullable();

export const createSubmissionSchema = z.object({
  enrollmentId: z.string().uuid(),
  githubUrl: githubRepoUrlSchema,
  liveUrl: optionalHttpsUrlSchema.optional(),
  notes: z.string().max(2000).default(''),
});

export type CreateSubmissionInput = z.infer<typeof createSubmissionSchema>;

export const reviewDecisionSchema = z.enum(['approve', 'reject']);
export type ReviewDecision = z.infer<typeof reviewDecisionSchema>;

/**
 * A rejection must carry feedback. Telling a student "no" with no reason is
 * the single worst thing this product could do, so the schema forbids it.
 */
export const reviewSubmissionSchema = z
  .object({
    decision: reviewDecisionSchema,
    feedback: z.string().trim().max(4000).default(''),
  })
  .superRefine((value, ctx) => {
    if (value.decision === 'reject' && value.feedback.length < 10) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['feedback'],
        message: 'A rejection needs written feedback of at least 10 characters',
      });
    }
  });

export type ReviewSubmissionInput = z.infer<typeof reviewSubmissionSchema>;

/** A submission as the admin review queue sees it. */
export const reviewQueueItemSchema = z.object({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  studentName: z.string(),
  studentEmail: z.string(),
  trackTitle: z.string(),
  projectTitle: z.string(),
  githubUrl: z.string(),
  liveUrl: z.string().nullable(),
  notes: z.string(),
  attemptNumber: z.number().int().positive(),
  submittedAt: z.string().datetime(),
});

export type ReviewQueueItem = z.infer<typeof reviewQueueItemSchema>;
