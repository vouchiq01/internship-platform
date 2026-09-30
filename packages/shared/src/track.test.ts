import { describe, expect, it } from 'vitest';
import { trackSchema, createEnrollmentSchema } from './track.js';

const validTrack = {
  id: '3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b',
  slug: 'development',
  title: 'Development',
  description: 'Ship a full-stack application.',
  priceInr: 1999,
  listPriceInr: 6000,
  durationWeeks: 8,
  thumbnailUrl: null,
  isPublished: true,
  sortOrder: 0,
};

describe('trackSchema', () => {
  it('accepts a valid track', () => {
    expect(trackSchema.parse(validTrack)).toEqual(validTrack);
  });

  it('allows a null list price', () => {
    expect(trackSchema.parse({ ...validTrack, listPriceInr: null }).listPriceInr).toBeNull();
  });

  it('rejects a negative price', () => {
    expect(() => trackSchema.parse({ ...validTrack, priceInr: -1 })).toThrow();
  });

  it('rejects a non-integer price', () => {
    expect(() => trackSchema.parse({ ...validTrack, priceInr: 1999.5 })).toThrow();
  });
});

describe('createEnrollmentSchema', () => {
  it('accepts a bare track id', () => {
    const parsed = createEnrollmentSchema.parse({
      trackId: '3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b',
    });
    expect(parsed.trackId).toBe('3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b');
  });

  it('strips any client-supplied price or amount', () => {
    const parsed = createEnrollmentSchema.parse({
      trackId: '3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b',
      priceInr: 1,
      amountPaise: 100,
    } as never);
    expect(parsed).not.toHaveProperty('priceInr');
    expect(parsed).not.toHaveProperty('amountPaise');
  });

  it('rejects a non-uuid track id', () => {
    expect(() => createEnrollmentSchema.parse({ trackId: 'dev' })).toThrow();
  });
});
