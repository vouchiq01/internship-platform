import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { EnrollmentDetail, SubmissionSummary } from '@internship/shared';
import { createSubmissionsRouter, type SubmissionsDeps } from './submissions.js';
import { AppError, errorHandler } from '../errors.js';

const USER = '99999999-9999-4999-8999-999999999999';
const ENR = '88888888-8888-4888-8888-888888888888';
const GH = 'https://github.com/asha/my-project';

const authed: RequestHandler = (req, _res, next) => {
  req.auth = { id: USER, email: 's@example.com', role: 'student' };
  next();
};

function detail(over: Partial<EnrollmentDetail> = {}): EnrollmentDetail {
  return {
    id: ENR,
    status: 'active',
    trackId: '77777777-7777-4777-8777-777777777777',
    trackSlug: 'development',
    trackTitle: 'Development',
    lessons: [],
    project: {
      id: '55555555-5555-4555-8555-555555555555',
      title: 'Full-stack app',
      briefMarkdown: '',
      requirements: '',
    },
    projectUnlocked: true,
    submissions: [],
    certificateNumber: null,
    ...over,
  };
}

const sub = (over: Partial<SubmissionSummary> = {}): SubmissionSummary => ({
  id: '66666666-6666-4666-8666-666666666666',
  githubUrl: GH,
  liveUrl: null,
  notes: '',
  status: 'pending',
  attemptNumber: 1,
  reviewFeedback: null,
  submittedAt: '2026-09-30T10:00:00.000Z',
  reviewedAt: null,
  ...over,
});

function buildApp(over: Partial<SubmissionsDeps> = {}) {
  const create = vi.fn(async () => sub());
  const deps: SubmissionsDeps = {
    auth: authed,
    getEnrollmentDetail: async (userId, id) =>
      userId === USER && id === ENR ? detail() : null,
    createSubmission: create,
    ...over,
  };
  const app = express();
  app.use(express.json());
  app.use('/api', createSubmissionsRouter(deps));
  app.use(errorHandler);
  return { app, create };
}

describe('POST /api/submissions', () => {
  it('accepts a valid first submission', async () => {
    const { app, create } = buildApp();
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({ enrollmentId: ENR, githubUrl: GH, attemptNumber: 1 }),
    );
  });

  it('rejects a non-GitHub URL', async () => {
    const { app, create } = buildApp();
    const res = await request(app)
      .post('/api/submissions')
      .send({ enrollmentId: ENR, githubUrl: 'https://gitlab.com/a/b' });
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it('404s an enrollment that is not the caller’s', async () => {
    const { app } = buildApp({ getEnrollmentDetail: async () => null });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(404);
  });

  it('REFUSES when the enrollment is not paid for', async () => {
    const { app, create } = buildApp({
      getEnrollmentDetail: async () => detail({ status: 'pending_payment' }),
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('enrollment_inactive');
    expect(create).not.toHaveBeenCalled();
  });

  it('REFUSES when lessons are not finished', async () => {
    const { app, create } = buildApp({
      getEnrollmentDetail: async () => detail({ projectUnlocked: false }),
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('project_locked');
    expect(create).not.toHaveBeenCalled();
  });

  it('REFUSES a second submission while one is pending review', async () => {
    const { app, create } = buildApp({
      getEnrollmentDetail: async () => detail({ submissions: [sub({ status: 'pending' })] }),
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('review_pending');
    expect(create).not.toHaveBeenCalled();
  });

  it('REFUSES a resubmission once already approved', async () => {
    const { app, create } = buildApp({
      getEnrollmentDetail: async () => detail({ submissions: [sub({ status: 'approved' })] }),
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_approved');
    expect(create).not.toHaveBeenCalled();
  });

  it('allows a resubmission after rejection and increments the attempt', async () => {
    const { app, create } = buildApp({
      getEnrollmentDetail: async () =>
        detail({ submissions: [sub({ status: 'rejected', attemptNumber: 2 })] }),
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(201);
    expect(create).toHaveBeenCalledWith(expect.objectContaining({ attemptNumber: 3 }));
  });

  it('has no project to submit when the track defines none', async () => {
    const { app } = buildApp({ getEnrollmentDetail: async () => detail({ project: null }) });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(404);
  });

  it('surfaces a storage failure rather than reporting success', async () => {
    const { app } = buildApp({
      createSubmission: async () => {
        throw new AppError(500, 'submission_write_failed', 'db down');
      },
    });
    const res = await request(app).post('/api/submissions').send({ enrollmentId: ENR, githubUrl: GH });
    expect(res.status).toBe(500);
  });
});
