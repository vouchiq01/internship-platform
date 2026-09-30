import { redirect } from 'next/navigation';
import type { Profile, ReportsSummary } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { AdminNav } from '@/components/admin/admin-nav';
import { StatTile } from '@/components/admin/stat-tile';
import { TrackBars } from '@/components/admin/track-bars';
import { MonthColumns } from '@/components/admin/month-columns';

function rupees(paise: number): string {
  return `₹${Math.round(paise / 100).toLocaleString('en-IN')}`;
}

export default async function AdminReportsPage() {
  let profile: Profile | null = null;
  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch {
    profile = null;
  }
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'admin') redirect('/dashboard');

  let summary: ReportsSummary | null = null;
  let loadError: string | null = null;
  try {
    summary = await apiFetch<ReportsSummary>('/api/admin/reports/summary');
  } catch (err) {
    loadError =
      err instanceof ApiError ? `Could not load reports (${err.code})` : 'Could not reach the API';
  }

  return (
    <div className="min-h-screen">
      <AdminNav current="/admin/reports" />

      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="anim-rise font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          Overview
        </p>
        <h1
          className="anim-clip mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1] tracking-[-0.02em]"
          style={{ animationDelay: '80ms' }}
        >
          Reports
        </h1>

        {loadError ? (
          <p
            role="alert"
            className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] text-bone-200"
          >
            {loadError}
          </p>
        ) : summary ? (
          <>
            <div className="anim-rise mt-10 grid gap-px border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-2 lg:grid-cols-4" style={{ animationDelay: '180ms' }}>
              <StatTile label="Revenue" value={rupees(summary.revenuePaise)} note="Paid, all time" />
              <StatTile
                label="Active"
                value={String(summary.activeEnrollments)}
                note="Enrolments in progress"
              />
              <StatTile
                label="Completion"
                value={`${summary.completionRatePct}%`}
                note="Of students who paid"
              />
              <StatTile
                label="Pending review"
                value={String(summary.pendingReviews)}
                note={summary.pendingReviews > 0 ? 'Waiting on you' : 'Nothing waiting'}
                accent={summary.pendingReviews > 0 ? 'var(--color-track-ops)' : undefined}
              />
            </div>

            <div className="mt-14 grid gap-10 lg:grid-cols-2 lg:gap-12">
              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                  Enrolments per month
                </h2>
                <p className="mt-2 text-sm text-bone-600">
                  Every enrolment, including those that never completed payment.
                </p>
                <div className="mt-7">
                  <MonthColumns data={summary.enrollmentsByMonth} />
                </div>
              </section>

              <section>
                <h2 className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                  Enrolments by track
                </h2>
                <p className="mt-2 text-sm text-bone-600">
                  Which track students actually pick.
                </p>
                <div className="mt-7">
                  <TrackBars data={summary.enrollmentsByTrack} />
                </div>
              </section>
            </div>

            <details className="mt-14 border-t border-[var(--rule)] pt-6">
              <summary className="cursor-pointer font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600 transition-colors hover:text-bone-100">
                View as a table
              </summary>
              <table className="mt-6 w-full border-collapse text-sm">
                <caption className="sr-only">Enrolments by track and by month</caption>
                <thead>
                  <tr className="border-b border-[var(--rule)] text-left">
                    <th scope="col" className="py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                      Group
                    </th>
                    <th scope="col" className="py-2 text-right font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                      Enrolments
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {summary.enrollmentsByTrack.map((t) => (
                    <tr key={t.trackSlug} className="border-b border-[var(--rule)]">
                      <td className="py-2.5 text-bone-200">{t.trackTitle}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-bone-400">
                        {t.count}
                      </td>
                    </tr>
                  ))}
                  {summary.enrollmentsByMonth.map((m) => (
                    <tr key={m.month} className="border-b border-[var(--rule)]">
                      <td className="py-2.5 text-bone-200">{m.month}</td>
                      <td className="py-2.5 text-right font-mono tabular-nums text-bone-400">
                        {m.count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </details>
          </>
        ) : null}
      </main>
    </div>
  );
}
