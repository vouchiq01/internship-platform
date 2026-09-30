import { describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import type { Track, TrackDetail } from '@internship/shared';
import { createTracksRouter } from './tracks.js';
import { errorHandler } from '../errors.js';

const dev: Track = {
  id: '11111111-1111-4111-8111-111111111111',
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

const qa: Track = { ...dev, id: '22222222-2222-4222-8222-222222222222', slug: 'qa', title: 'QA', sortOrder: 1 };

const devDetail: TrackDetail = {
  ...dev,
  lessons: [
    { id: '33333333-3333-4333-8333-333333333333', title: 'Lesson one', description: '', youtubeVideoId: 'abc', durationMinutes: 10, sortOrder: 0 },
    { id: '44444444-4444-4444-8444-444444444444', title: 'Lesson two', description: '', youtubeVideoId: 'def', durationMinutes: 12, sortOrder: 1 },
  ],
  project: { id: '55555555-5555-4555-8555-555555555555', title: 'Full-stack app', briefMarkdown: 'Build it.', requirements: '- Auth' },
};

function buildApp(detail: TrackDetail | null = devDetail) {
  const app = express();
  app.use('/api', createTracksRouter({
    listTracks: async () => [dev, qa],
    getTrackBySlug: async (slug) => (detail && detail.slug === slug ? detail : null),
  }));
  app.use(errorHandler);
  return app;
}

describe('GET /api/tracks', () => {
  it('returns published tracks in sort order', async () => {
    const res = await request(buildApp()).get('/api/tracks');
    expect(res.status).toBe(200);
    expect(res.body.map((t: Track) => t.slug)).toEqual(['development', 'qa']);
  });

  it('never exposes an unpublished track through the list', async () => {
    const app = express();
    app.use('/api', createTracksRouter({
      listTracks: async () => [dev, { ...qa, isPublished: false }],
      getTrackBySlug: async () => null,
    }));
    const res = await request(app).get('/api/tracks');
    expect(res.body.every((t: Track) => t.isPublished)).toBe(true);
  });
});

describe('GET /api/tracks/:slug', () => {
  it('returns the track with lessons in order', async () => {
    const res = await request(buildApp()).get('/api/tracks/development');
    expect(res.status).toBe(200);
    expect(res.body.lessons.map((l: { sortOrder: number }) => l.sortOrder)).toEqual([0, 1]);
    expect(res.body.project.title).toBe('Full-stack app');
  });

  it('404s an unknown slug', async () => {
    const res = await request(buildApp()).get('/api/tracks/nope');
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('not_found');
  });

  it('404s an unpublished track even by direct slug', async () => {
    const res = await request(buildApp({ ...devDetail, isPublished: false })).get('/api/tracks/development');
    expect(res.status).toBe(404);
  });
});
