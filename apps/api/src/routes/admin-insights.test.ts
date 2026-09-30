import { describe, expect, it, vi } from 'vitest';
import express, { type RequestHandler } from 'express';
import request from 'supertest';
import type { UserRole } from '@internship/shared';
import { createAdminInsightsRouter, type AdminInsightsDeps } from './admin-insights.js';
import { requireAdmin } from '../middleware/auth.js';
import { errorHandler } from '../errors.js';

const as = (role: UserRole): RequestHandler => (req, _res, next) => {
  req.auth = { id: 'admin-1', email: 'a@example.com', role };
  next();
};

function buildApp(role: UserRole = 'admin', over: Partial<AdminInsightsDeps> = {}) {
  const listStudents = vi.fn(async () => []);
  const reportInputs = vi.fn(async () => ({
    enrollments: [
      { status: 'completed' as const, enrolledAt: '2026-01-05T00:00:00Z', trackSlug: 'development', trackTitle: 'Development' },
      { status: 'active' as const, enrolledAt: '2026-02-05T00:00:00Z', trackSlug: 'qa', trackTitle: 'QA' },
      { status: 'pending_payment' as const, enrolledAt: '2026-02-06T00:00:00Z', trackSlug: 'qa', trackTitle: 'QA' },
    ],
    paidAmountsPaise: [199900, 199900],
    pendingReviews: 3,
  }));

  const app = express();
  app.use('/api/admin', createAdminInsightsRouter({
    auth: as(role), requireAdmin, listStudents, reportInputs, ...over,
  }));
  app.use(errorHandler);
  return { app, listStudents, reportInputs };
}

describe('GET /api/admin/students', () => {
  it('FORBIDS a student', async () => {
    const { app, listStudents } = buildApp('student');
    expect((await request(app).get('/api/admin/students')).status).toBe(403);
    expect(listStudents).not.toHaveBeenCalled();
  });

  it('passes a trimmed search term through', async () => {
    const { app, listStudents } = buildApp();
    await request(app).get('/api/admin/students?q=%20asha%20');
    expect(listStudents).toHaveBeenCalledWith('asha');
  });

  it('treats a missing query as an empty search', async () => {
    const { app, listStudents } = buildApp();
    await request(app).get('/api/admin/students');
    expect(listStudents).toHaveBeenCalledWith('');
  });

  it('caps an absurdly long search term', async () => {
    const { app, listStudents } = buildApp();
    await request(app).get(`/api/admin/students?q=${'a'.repeat(500)}`);
    expect((listStudents.mock.calls[0] as unknown as string[])[0]).toHaveLength(100);
  });
});

describe('GET /api/admin/reports/summary', () => {
  it('FORBIDS a student', async () => {
    const { app, reportInputs } = buildApp('student');
    expect((await request(app).get('/api/admin/reports/summary')).status).toBe(403);
    expect(reportInputs).not.toHaveBeenCalled();
  });

  it('returns aggregated figures', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/admin/reports/summary');
    expect(res.status).toBe(200);
    expect(res.body.revenuePaise).toBe(399800);
    expect(res.body.activeEnrollments).toBe(1);
    expect(res.body.completedEnrollments).toBe(1);
    expect(res.body.pendingReviews).toBe(3);
    // 1 completed of 2 who paid = 50%. The pending_payment row is excluded.
    expect(res.body.completionRatePct).toBe(50);
  });

  it('includes per-track and per-month breakdowns', async () => {
    const { app } = buildApp();
    const res = await request(app).get('/api/admin/reports/summary');
    expect(res.body.enrollmentsByTrack).toHaveLength(2);
    expect(res.body.enrollmentsByMonth).toEqual([
      { month: '2026-01', count: 1 },
      { month: '2026-02', count: 2 },
    ]);
  });
});
