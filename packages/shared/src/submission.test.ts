import { describe, expect, it } from 'vitest';
import { createSubmissionSchema, reviewSubmissionSchema } from './submission.js';

const ENR = '88888888-8888-4888-8888-888888888888';
const base = { enrollmentId: ENR, notes: '' };

describe('createSubmissionSchema — GitHub URL', () => {
  it('accepts a normal repository URL', () => {
    const parsed = createSubmissionSchema.parse({
      ...base,
      githubUrl: 'https://github.com/asha/my-project',
    });
    expect(parsed.githubUrl).toBe('https://github.com/asha/my-project');
  });

  it('accepts a www.github.com URL', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'https://www.github.com/a/b' }),
    ).not.toThrow();
  });

  it('trims surrounding whitespace', () => {
    const parsed = createSubmissionSchema.parse({
      ...base,
      githubUrl: '  https://github.com/asha/my-project  ',
    });
    expect(parsed.githubUrl).toBe('https://github.com/asha/my-project');
  });

  it('rejects a lookalike domain that merely contains github.com', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'https://github.com.evil.test/a/b' }),
    ).toThrow();
  });

  it('rejects a userinfo trick pointing at another host', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'https://github.com@evil.test/a/b' }),
    ).toThrow();
  });

  it('rejects a javascript: URL', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'javascript:alert(1)' }),
    ).toThrow();
  });

  it('rejects plain http', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'http://github.com/a/b' }),
    ).toThrow();
  });

  it('rejects a profile URL with no repository', () => {
    expect(() =>
      createSubmissionSchema.parse({ ...base, githubUrl: 'https://github.com/asha' }),
    ).toThrow();
  });

  it('rejects an empty string', () => {
    expect(() => createSubmissionSchema.parse({ ...base, githubUrl: '' })).toThrow();
  });

  it('turns an empty live URL into null', () => {
    const parsed = createSubmissionSchema.parse({
      ...base,
      githubUrl: 'https://github.com/a/b',
      liveUrl: '',
    });
    expect(parsed.liveUrl).toBeNull();
  });
});

describe('reviewSubmissionSchema', () => {
  it('allows an approval with no feedback', () => {
    expect(reviewSubmissionSchema.parse({ decision: 'approve' }).decision).toBe('approve');
  });

  it('allows a rejection with real feedback', () => {
    const parsed = reviewSubmissionSchema.parse({
      decision: 'reject',
      feedback: 'The README is missing setup steps.',
    });
    expect(parsed.decision).toBe('reject');
  });

  it('REFUSES a rejection with no feedback', () => {
    expect(() => reviewSubmissionSchema.parse({ decision: 'reject' })).toThrow();
  });

  it('REFUSES a rejection with token feedback', () => {
    expect(() => reviewSubmissionSchema.parse({ decision: 'reject', feedback: 'no' })).toThrow();
  });

  it('rejects an unknown decision', () => {
    expect(() => reviewSubmissionSchema.parse({ decision: 'maybe' })).toThrow();
  });
});
