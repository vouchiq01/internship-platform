import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { UserRole } from '@internship/shared';
import { createAdminManageRouter, type AdminManageDeps } from './admin-manage.js';
import { requireAdmin } from '../middleware/auth.js';
import { errorHandler } from '../errors.js';

const TRACK = '11111111-1111-4111-8111-111111111111';
const LESSON = '22222222-2222-4222-8222-222222222222';
const CERT = '33333333-3333-4333-8333-333333333333';

const as = (role: UserRole): RequestHandler => (req, _res, next) => {
  req.auth = { id: 'admin-1', email: 'a@example.com', role };
  next();
};

function buildApp(role: UserRole = 'admin', over: Partial<AdminManageDeps> = {}) {
  const fns = {
    listAllTracks: vi.fn(async () => []),
    createTrack: vi.fn(async () => ({ id: TRACK })),
    updateTrack: vi.fn(async () => {}),
    deleteTrack: vi.fn(async () => {}),
    createLesson: vi.fn(async () => ({ id: LESSON })),
    updateLesson: vi.fn(async () => {}),
    deleteLesson: vi.fn(async () => {}),
    reorderLessons: vi.fn(async () => {}),
    upsertProject: vi.fn(async () => {}),
    revokeCertificate: vi.fn(async () => true),
    logAudit: vi.fn(async () => {}),
  };

  const app = express();
  app.use(express.json());
  app.use(
    '/api/admin',
    createAdminManageRouter({ auth: as(role), requireAdmin, ...fns, ...over }),
  );
  app.use(errorHandler);
  return { app, ...fns };
}

const validTrack = {
  slug: 'security',
  title: 'Security Engineering',
  description: 'Break it, then fix it.',
  priceInr: 1999,
  listPriceInr: 6000,
  durationWeeks: 8,
  isPublished: false,
  sortOrder: 4,
};

describe('admin authorisation', () => {
  it('FORBIDS a student from listing tracks', async () => {
    const { app } = buildApp('student');
    expect((await request(app).get('/api/admin/tracks')).status).toBe(403);
  });

  it('FORBIDS a student from creating a track', async () => {
    const { app, createTrack } = buildApp('student');
    expect((await request(app).post('/api/admin/tracks').send(validTrack)).status).toBe(403);
    expect(createTrack).not.toHaveBeenCalled();
  });

  it('FORBIDS a student from creating a lesson', async () => {
    const { app, createLesson } = buildApp('student');
    expect((await request(app).post('/api/admin/lessons').send({})).status).toBe(403);
    expect(createLesson).not.toHaveBeenCalled();
  });

  it('FORBIDS a student from reordering lessons', async () => {
    const { app, reorderLessons } = buildApp('student');
    expect((await request(app).post('/api/admin/lessons/reorder').send({})).status).toBe(403);
    expect(reorderLessons).not.toHaveBeenCalled();
  });

  it('FORBIDS a student from editing the project brief', async () => {
    const { app, upsertProject } = buildApp('student');
    expect((await request(app).put('/api/admin/projects').send({})).status).toBe(403);
    expect(upsertProject).not.toHaveBeenCalled();
  });

  it('FORBIDS a student from deleting a track', async () => {
    const { app, deleteTrack } = buildApp('student');
    expect((await request(app).delete(`/api/admin/tracks/${TRACK}`)).status).toBe(403);
    expect(deleteTrack).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/tracks', () => {
  it('creates a track', async () => {
    const { app, createTrack } = buildApp();
    const res = await request(app).post('/api/admin/tracks').send(validTrack);
    expect(res.status).toBe(201);
    expect(createTrack).toHaveBeenCalledWith(expect.objectContaining({ slug: 'security' }));
  });

  it('rejects an invalid slug', async () => {
    const { app, createTrack } = buildApp();
    const res = await request(app).post('/api/admin/tracks').send({ ...validTrack, slug: 'Bad Slug' });
    expect(res.status).toBe(400);
    expect(createTrack).not.toHaveBeenCalled();
  });

  it('rejects a list price below the sale price', async () => {
    const { app, createTrack } = buildApp();
    const res = await request(app)
      .post('/api/admin/tracks')
      .send({ ...validTrack, priceInr: 6000, listPriceInr: 1999 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_list_price');
    expect(createTrack).not.toHaveBeenCalled();
  });

  it('surfaces a duplicate slug as a 409', async () => {
    const { app } = buildApp('admin', {
      createTrack: async () => {
        throw Object.assign(new Error('duplicate key value violates unique constraint'), {});
      },
    });
    const res = await request(app).post('/api/admin/tracks').send(validTrack);
    expect(res.status).toBe(409);
  });
});

describe('POST /api/admin/lessons', () => {
  it('normalises a pasted YouTube URL before storing', async () => {
    const { app, createLesson } = buildApp();
    const res = await request(app).post('/api/admin/lessons').send({
      trackId: TRACK,
      title: 'How the web works',
      youtubeVideoId: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=30',
      durationMinutes: 18,
      sortOrder: 0,
    });
    expect(res.status).toBe(201);
    expect(createLesson).toHaveBeenCalledWith(
      expect.objectContaining({ youtubeVideoId: 'dQw4w9WgXcQ' }),
    );
  });

  it('rejects a non-YouTube link', async () => {
    const { app, createLesson } = buildApp();
    const res = await request(app).post('/api/admin/lessons').send({
      trackId: TRACK,
      title: 'Nope',
      youtubeVideoId: 'https://vimeo.com/123',
      sortOrder: 0,
    });
    expect(res.status).toBe(400);
    expect(createLesson).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/lessons/reorder', () => {
  it('reorders by array position', async () => {
    const { app, reorderLessons } = buildApp();
    const ids = [LESSON, '44444444-4444-4444-8444-444444444444'];
    const res = await request(app)
      .post('/api/admin/lessons/reorder')
      .send({ trackId: TRACK, lessonIds: ids });
    expect(res.status).toBe(200);
    expect(reorderLessons).toHaveBeenCalledWith(TRACK, ids);
  });

  it('rejects duplicate ids rather than corrupting sort order', async () => {
    const { app, reorderLessons } = buildApp();
    const res = await request(app)
      .post('/api/admin/lessons/reorder')
      .send({ trackId: TRACK, lessonIds: [LESSON, LESSON] });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('duplicate_lesson');
    expect(reorderLessons).not.toHaveBeenCalled();
  });
});

describe('POST /api/admin/certificates/:id/revoke', () => {
  it('revokes a certificate and logs it', async () => {
    const { app, revokeCertificate, logAudit } = buildApp();
    const res = await request(app)
      .post(`/api/admin/certificates/${CERT}/revoke`)
      .send({ reason: 'Plagiarised project' });
    expect(res.status).toBe(200);
    expect(revokeCertificate).toHaveBeenCalledWith(CERT);
    expect(logAudit).toHaveBeenCalled();
  });

  it('FORBIDS a student from revoking', async () => {
    const { app, revokeCertificate } = buildApp('student');
    const res = await request(app).post(`/api/admin/certificates/${CERT}/revoke`).send({});
    expect(res.status).toBe(403);
    expect(revokeCertificate).not.toHaveBeenCalled();
  });

  it('404s an unknown certificate', async () => {
    const { app } = buildApp('admin', { revokeCertificate: async () => false });
    const res = await request(app).post(`/api/admin/certificates/${CERT}/revoke`).send({});
    expect(res.status).toBe(404);
  });
});
