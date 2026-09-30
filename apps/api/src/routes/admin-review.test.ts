import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { ReviewQueueItem } from '@internship/shared';
import { createAdminReviewRouter, type AdminReviewDeps } from './admin-review.js';
import { requireAdmin } from '../middleware/auth.js';
import { errorHandler } from '../errors.js';
import type { UserRole } from '@internship/shared';

const SUB = '66666666-6666-4666-8666-666666666666';
const ENR = '88888888-8888-4888-8888-888888888888';

const as = (role: UserRole): RequestHandler => (req, _res, next) => {
  req.auth = { id: 'admin-1', email: 'a@example.com', role };
  next();
};

const queueItem: ReviewQueueItem = {
  id: SUB,
  enrollmentId: '88888888-8888-4888-8888-888888888888',
  studentName: 'Asha Kumar',
  studentEmail: 'asha@example.com',
  trackTitle: 'Development',
  projectTitle: 'Full-stack app',
  githubUrl: 'https://github.com/asha/my-project',
  liveUrl: null,
  notes: '',
  attemptNumber: 1,
  submittedAt: '2026-09-30T10:00:00.000Z',
};

function buildApp(role: UserRole = 'admin', over: Partial<AdminReviewDeps> = {}) {
  const applyReview = vi.fn(async () => {});
  const logAudit = vi.fn(async () => {});
  const onApproved = vi.fn(async () => ({ certificateNumber: 'INTX-2026-DEV-00042' }));

  const deps: AdminReviewDeps = {
    auth: as(role),
    requireAdmin,
    listPending: async () => [queueItem],
    getSubmission: async (id) => (id === SUB ? { status: 'pending', enrollmentId: ENR } : null),
    applyReview,
    logAudit,
    onApproved,
    ...over,
  };

  const app = express();
  app.use(express.json());
  app.use('/api/admin', createAdminReviewRouter(deps));
  app.use(errorHandler);
  return { app, applyReview, logAudit, onApproved };
}

describe('GET /api/admin/submissions', () => {
  it('returns the pending queue for an admin', async () => {
    const { app } = buildApp('admin');
    const res = await request(app).get('/api/admin/submissions');
    expect(res.status).toBe(200);
    expect(res.body[0].studentName).toBe('Asha Kumar');
  });

  it('FORBIDS a student from reading the queue', async () => {
    const { app } = buildApp('student');
    const res = await request(app).get('/api/admin/submissions');
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('forbidden');
  });
});

describe('POST /api/admin/submissions/:id/review', () => {
  it('FORBIDS a student from approving anything', async () => {
    const { app, applyReview } = buildApp('student');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(403);
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('approves a pending submission', async () => {
    const { app, applyReview, logAudit } = buildApp('admin');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(200);
    expect(applyReview).toHaveBeenCalledWith(SUB, 'admin-1', 'approved', '');
    expect(logAudit).toHaveBeenCalled();
  });

  it('issues a certificate when a submission is approved', async () => {
    const { app, onApproved } = buildApp('admin');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'approve' });
    expect(onApproved).toHaveBeenCalledWith(ENR);
    expect(res.body.certificateNumber).toBe('INTX-2026-DEV-00042');
  });

  it('does NOT issue a certificate on rejection', async () => {
    const { app, onApproved } = buildApp('admin');
    await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'reject', feedback: 'The README has no setup steps.' });
    expect(onApproved).not.toHaveBeenCalled();
  });

  it('rejects with feedback', async () => {
    const { app, applyReview } = buildApp('admin');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'reject', feedback: 'The README has no setup steps.' });
    expect(res.status).toBe(200);
    expect(applyReview).toHaveBeenCalledWith(
      SUB,
      'admin-1',
      'rejected',
      'The README has no setup steps.',
    );
  });

  it('REFUSES a rejection with no feedback', async () => {
    const { app, applyReview } = buildApp('admin');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'reject' });
    expect(res.status).toBe(400);
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('404s an unknown submission', async () => {
    const { app, applyReview } = buildApp('admin', { getSubmission: async () => null });
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'approve' });
    expect(res.status).toBe(404);
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('REFUSES to review a submission that was already reviewed', async () => {
    const { app, applyReview } = buildApp('admin', {
      getSubmission: async () => ({ status: 'approved', enrollmentId: ENR }),
    });
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'reject', feedback: 'Changed my mind about this one.' });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('already_reviewed');
    expect(applyReview).not.toHaveBeenCalled();
  });

  it('rejects an unknown decision value', async () => {
    const { app, applyReview } = buildApp('admin');
    const res = await request(app)
      .post(`/api/admin/submissions/${SUB}/review`)
      .send({ decision: 'maybe' });
    expect(res.status).toBe(400);
    expect(applyReview).not.toHaveBeenCalled();
  });
});
