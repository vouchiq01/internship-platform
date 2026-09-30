import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  summariseReports,
  type AdminStudent,
  type RawEnrollment,
  type ReportsSummary,
} from '@internship/shared';
import { AppError } from '../errors.js';

export interface AdminInsightsDeps {
  auth: RequestHandler;
  requireAdmin: RequestHandler;
  listStudents(search: string): Promise<AdminStudent[]>;
  reportInputs(): Promise<{
    enrollments: RawEnrollment[];
    paidAmountsPaise: number[];
    pendingReviews: number;
  }>;
}

export function createAdminInsightsRouter(deps: AdminInsightsDeps): Router {
  const router = Router();
  const guard = [deps.auth, deps.requireAdmin] as const;

  router.get('/students', ...guard, async (req, res, next) => {
    try {
      const raw = req.query.q;
      const search = typeof raw === 'string' ? raw.trim().slice(0, 100) : '';
      res.json(await deps.listStudents(search));
    } catch (err) {
      next(err);
    }
  });

  router.get('/reports/summary', ...guard, async (_req, res, next) => {
    try {
      const inputs = await deps.reportInputs();
      const summary: ReportsSummary = summariseReports(inputs);
      res.json(summary);
    } catch (err) {
      next(err);
    }
  });

  return router;
}

export function createAdminInsightsDeps(
  supabase: SupabaseClient,
  auth: RequestHandler,
  requireAdmin: RequestHandler,
): AdminInsightsDeps {
  const first = <T>(v: T | T[] | null | undefined): T | null =>
    Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

  return {
    auth,
    requireAdmin,

    async listStudents(search) {
      let query = supabase
        .from('profiles')
        .select('id, full_name, email, college, graduation_year, created_at')
        .eq('role', 'student')
        .order('created_at', { ascending: false })
        .limit(200);

      if (search) {
        // Escape PostgREST's or() delimiters so a comma or paren in the search
        // box cannot rewrite the filter expression.
        const safe = search.replace(/[,()]/g, ' ');
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }

      const { data, error } = await query;
      if (error) throw new AppError(500, 'student_list_failed', error.message);

      type ProfileRow = {
        id: string;
        full_name: string;
        email: string;
        college: string | null;
        graduation_year: number | null;
        created_at: string;
      };
      const profiles = (data ?? []) as ProfileRow[];
      const ids = profiles.map((p) => p.id);
      if (ids.length === 0) return [];

      const [{ data: enrollmentRows }, { data: paymentRows }] = await Promise.all([
        supabase.from('enrollments').select('user_id, status').in('user_id', ids),
        supabase
          .from('payments')
          .select('user_id, amount_paise')
          .eq('status', 'paid')
          .in('user_id', ids),
      ]);

      const counts = new Map<string, { total: number; completed: number }>();
      for (const row of (enrollmentRows ?? []) as { user_id: string; status: string }[]) {
        const entry = counts.get(row.user_id) ?? { total: 0, completed: 0 };
        entry.total += 1;
        if (row.status === 'completed') entry.completed += 1;
        counts.set(row.user_id, entry);
      }

      const paid = new Map<string, number>();
      for (const row of (paymentRows ?? []) as { user_id: string; amount_paise: number }[]) {
        paid.set(row.user_id, (paid.get(row.user_id) ?? 0) + Number(row.amount_paise));
      }

      return profiles.map((p) => ({
        id: p.id,
        fullName: p.full_name,
        email: p.email,
        college: p.college,
        graduationYear: p.graduation_year,
        createdAt: p.created_at,
        enrollmentCount: counts.get(p.id)?.total ?? 0,
        completedCount: counts.get(p.id)?.completed ?? 0,
        totalPaidPaise: paid.get(p.id) ?? 0,
      }));
    },

    async reportInputs() {
      const [{ data: enrollmentRows, error: eErr }, { data: paymentRows }, { count }] =
        await Promise.all([
          supabase.from('enrollments').select('status, enrolled_at, tracks(title, slug)'),
          supabase.from('payments').select('amount_paise').eq('status', 'paid'),
          supabase
            .from('submissions')
            .select('id', { count: 'exact', head: true })
            .eq('status', 'pending'),
        ]);
      if (eErr) throw new AppError(500, 'reports_failed', eErr.message);

      type Row = {
        status: RawEnrollment['status'];
        enrolled_at: string;
        tracks: { title: string; slug: string } | { title: string; slug: string }[] | null;
      };

      return {
        enrollments: ((enrollmentRows ?? []) as unknown as Row[]).map((row) => ({
          status: row.status,
          enrolledAt: row.enrolled_at,
          trackTitle: first(row.tracks)?.title ?? 'Unknown',
          trackSlug: first(row.tracks)?.slug ?? 'unknown',
        })),
        paidAmountsPaise: ((paymentRows ?? []) as { amount_paise: number }[]).map((r) =>
          Number(r.amount_paise),
        ),
        pendingReviews: count ?? 0,
      };
    },
  };
}
