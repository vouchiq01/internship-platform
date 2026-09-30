import { describe, expect, it } from 'vitest';
import {
  extractYouTubeId,
  summariseReports,
  upsertLessonSchema,
  upsertTrackSchema,
  type RawEnrollment,
} from './admin.js';

describe('extractYouTubeId', () => {
  it.each([
    ['https://www.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://m.youtube.com/watch?v=dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://youtu.be/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/shorts/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['https://www.youtube.com/live/dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['dQw4w9WgXcQ', 'dQw4w9WgXcQ'],
    ['  https://youtu.be/dQw4w9WgXcQ  ', 'dQw4w9WgXcQ'],
  ])('extracts from %s', (input, expected) => {
    expect(extractYouTubeId(input)).toBe(expected);
  });

  it('ignores a timestamp', () => {
    expect(extractYouTubeId('https://youtu.be/dQw4w9WgXcQ?t=42')).toBe('dQw4w9WgXcQ');
  });

  it('ignores playlist and tracking parameters', () => {
    expect(
      extractYouTubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ&list=PL123&index=2&si=abc'),
    ).toBe('dQw4w9WgXcQ');
  });

  it.each([
    ['https://vimeo.com/123456789'],
    ['https://notyoutube.com/watch?v=dQw4w9WgXcQ'],
    ['https://youtube.com.evil.test/watch?v=dQw4w9WgXcQ'],
    ['https://www.youtube.com/playlist?list=PL123'],
    ['https://www.youtube.com/@somechannel'],
    ['tooshort'],
    ['waaaaaaaaytoooooolong'],
    ['not a url at all'],
    [''],
    ['   '],
  ])('returns null for %j', (input) => {
    expect(extractYouTubeId(input)).toBeNull();
  });
});

describe('upsertLessonSchema', () => {
  const base = { trackId: '11111111-1111-4111-8111-111111111111', title: 'Lesson', sortOrder: 0 };

  it('normalises a pasted watch URL to a bare id', () => {
    const parsed = upsertLessonSchema.parse({
      ...base,
      youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30',
    });
    expect(parsed.youtubeVideoId).toBe('dQw4w9WgXcQ');
  });

  it('rejects a non-YouTube link rather than storing it', () => {
    expect(() =>
      upsertLessonSchema.parse({ ...base, youtubeVideoId: 'https://vimeo.com/123' }),
    ).toThrow();
  });
});

describe('upsertTrackSchema', () => {
  const base = { title: 'Development', priceInr: 1999, durationWeeks: 8 };

  it('accepts a kebab-case slug', () => {
    expect(upsertTrackSchema.parse({ ...base, slug: 'ai-engineering' }).slug).toBe('ai-engineering');
  });

  it.each(['AI-Engineering', 'ai engineering', 'ai_engineering', '-ai', 'ai-'])(
    'rejects slug %j',
    (slug) => {
      expect(() => upsertTrackSchema.parse({ ...base, slug })).toThrow();
    },
  );

  it('rejects a negative price', () => {
    expect(() => upsertTrackSchema.parse({ ...base, slug: 'dev', priceInr: -1 })).toThrow();
  });

  it('defaults a new track to unpublished', () => {
    expect(upsertTrackSchema.parse({ ...base, slug: 'dev' }).isPublished).toBe(false);
  });
});

describe('summariseReports', () => {
  const enrollment = (
    status: RawEnrollment['status'],
    enrolledAt: string,
    slug = 'development',
  ): RawEnrollment => ({ status, enrolledAt, trackSlug: slug, trackTitle: slug });

  it('sums revenue from paid payments only', () => {
    const r = summariseReports({
      enrollments: [],
      paidAmountsPaise: [199900, 199900, 199900],
      pendingReviews: 0,
    });
    expect(r.revenuePaise).toBe(599700);
  });

  it('computes the completion rate over students who actually paid', () => {
    const r = summariseReports({
      enrollments: [
        enrollment('completed', '2026-01-05T00:00:00Z'),
        enrollment('active', '2026-01-06T00:00:00Z'),
        enrollment('active', '2026-01-07T00:00:00Z'),
        // pending_payment must NOT drag the rate down — they never started.
        enrollment('pending_payment', '2026-01-08T00:00:00Z'),
        enrollment('pending_payment', '2026-01-09T00:00:00Z'),
      ],
      paidAmountsPaise: [],
      pendingReviews: 0,
    });
    expect(r.completionRatePct).toBe(33.3);
    expect(r.activeEnrollments).toBe(2);
    expect(r.completedEnrollments).toBe(1);
  });

  it('returns a zero rate rather than NaN when nobody has started', () => {
    const r = summariseReports({ enrollments: [], paidAmountsPaise: [], pendingReviews: 0 });
    expect(r.completionRatePct).toBe(0);
    expect(Number.isNaN(r.completionRatePct)).toBe(false);
  });

  it('groups by track, most popular first', () => {
    const r = summariseReports({
      enrollments: [
        enrollment('active', '2026-01-05T00:00:00Z', 'qa'),
        enrollment('active', '2026-01-05T00:00:00Z', 'development'),
        enrollment('active', '2026-01-05T00:00:00Z', 'development'),
      ],
      paidAmountsPaise: [],
      pendingReviews: 0,
    });
    expect(r.enrollmentsByTrack[0]).toMatchObject({ trackSlug: 'development', count: 2 });
    expect(r.enrollmentsByTrack[1]).toMatchObject({ trackSlug: 'qa', count: 1 });
  });

  it('groups by month in chronological order', () => {
    const r = summariseReports({
      enrollments: [
        enrollment('active', '2026-03-05T00:00:00Z'),
        enrollment('active', '2026-01-05T00:00:00Z'),
        enrollment('active', '2026-01-20T00:00:00Z'),
      ],
      paidAmountsPaise: [],
      pendingReviews: 0,
    });
    expect(r.enrollmentsByMonth).toEqual([
      { month: '2026-01', count: 2 },
      { month: '2026-03', count: 1 },
    ]);
  });

  it('passes the pending review count through', () => {
    const r = summariseReports({ enrollments: [], paidAmountsPaise: [], pendingReviews: 7 });
    expect(r.pendingReviews).toBe(7);
  });
});
