import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { EnrollmentDetail } from '@internship/shared';
import { createLearningRouter, type LearningDeps } from './learning.js';
import { AppError, errorHandler } from '../errors.js';

const USER = '99999999-9999-4999-8999-999999999999';
const ENR = '88888888-8888-4888-8888-888888888888';
const L0 = '00000000-0000-4000-8000-000000000000';
const L1 = '11111111-1111-4111-8111-111111111111';
const L2 = '22222222-2222-4222-8222-222222222222';

const authed: RequestHandler = (req, _res, next) => {
  req.auth = { id: USER, email: 's@example.com', role: 'student' };
  next();
};

function detail(completed: string[] = []): EnrollmentDetail {
  const base = [L0, L1, L2].map((id, i) => ({
    id,
    title: `Lesson ${i}`,
    description: '',
    youtubeVideoId: 'abc',
    durationMinutes: 10,
    sortOrder: i,
    completed: completed.includes(id),
  }));
  let prev = true;
  const lessons = base.map((l) => {
    const unlocked = prev;
    prev = l.completed;
    return { ...l, unlocked };
  });
  return {
    id: ENR,
    status: 'active',
    trackId: '77777777-7777-4777-8777-777777777777',
    trackSlug: 'development',
    trackTitle: 'Development',
    lessons,
    project: null,
    projectUnlocked: lessons.every((l) => l.completed),
    submissions: [],
    certificateNumber: null,
  };
}

function buildApp(overrides: Partial<LearningDeps> = {}, completed: string[] = []) {
  const markComplete = vi.fn(async () => {});
  const deps: LearningDeps = {
    auth: authed,
    getEnrollmentDetail: async (userId, id) =>
      userId === USER && id === ENR ? detail(completed) : null,
    findEnrollmentForLesson: async (userId, lessonId) =>
      userId === USER && [L0, L1, L2].includes(lessonId)
        ? { enrollmentId: ENR, detail: detail(completed) }
        : null,
    markLessonComplete: markComplete,
    ...overrides,
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createLearningRouter(deps));
  app.use(errorHandler);
  return { app, markComplete };
}

describe('GET /api/enrollments/:id', () => {
  it('returns the enrollment with unlock state', async () => {
    const { app } = buildApp({}, [L0]);
    const res = await request(app).get(`/api/enrollments/${ENR}`);
    expect(res.status).toBe(200);
    expect(res.body.lessons.map((l: { unlocked: boolean }) => l.unlocked)).toEqual([true, true, false]);
  });

  it('404s an enrollment belonging to someone else', async () => {
    const { app } = buildApp({ getEnrollmentDetail: async () => null });
    const res = await request(app).get(`/api/enrollments/${ENR}`);
    expect(res.status).toBe(404);
  });

  it('unlocks the project only when every lesson is complete', async () => {
    const partial = await request(buildApp({}, [L0, L1]).app).get(`/api/enrollments/${ENR}`);
    expect(partial.body.projectUnlocked).toBe(false);

    const all = await request(buildApp({}, [L0, L1, L2]).app).get(`/api/enrollments/${ENR}`);
    expect(all.body.projectUnlocked).toBe(true);
  });
});

describe('POST /api/lessons/:id/complete', () => {
  it('completes the first lesson for a new student', async () => {
    const { app, markComplete } = buildApp();
    const res = await request(app).post(`/api/lessons/${L0}/complete`);
    expect(res.status).toBe(200);
    expect(markComplete).toHaveBeenCalledWith(ENR, L0);
  });

  it('REFUSES to complete a locked lesson', async () => {
    const { app, markComplete } = buildApp();
    const res = await request(app).post(`/api/lessons/${L2}/complete`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('lesson_locked');
    expect(markComplete).not.toHaveBeenCalled();
  });

  it('allows the next lesson once the previous is done', async () => {
    const { app, markComplete } = buildApp({}, [L0]);
    const res = await request(app).post(`/api/lessons/${L1}/complete`);
    expect(res.status).toBe(200);
    expect(markComplete).toHaveBeenCalledWith(ENR, L1);
  });

  it('is idempotent on an already-completed lesson', async () => {
    const { app } = buildApp({}, [L0]);
    const res = await request(app).post(`/api/lessons/${L0}/complete`);
    expect(res.status).toBe(200);
  });

  it('404s a lesson the student is not enrolled for', async () => {
    const { app, markComplete } = buildApp({ findEnrollmentForLesson: async () => null });
    const res = await request(app).post(`/api/lessons/${L0}/complete`);
    expect(res.status).toBe(404);
    expect(markComplete).not.toHaveBeenCalled();
  });

  it('REFUSES when the enrollment is not yet paid for', async () => {
    const { app, markComplete } = buildApp({
      findEnrollmentForLesson: async () => ({
        enrollmentId: ENR,
        detail: { ...detail(), status: 'pending_payment' },
      }),
    });
    const res = await request(app).post(`/api/lessons/${L0}/complete`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('enrollment_inactive');
    expect(markComplete).not.toHaveBeenCalled();
  });

  it('surfaces a storage failure as a 500, not a silent success', async () => {
    const { app } = buildApp({
      markLessonComplete: async () => {
        throw new AppError(500, 'progress_write_failed', 'db down');
      },
    });
    const res = await request(app).post(`/api/lessons/${L0}/complete`);
    expect(res.status).toBe(500);
  });
});
