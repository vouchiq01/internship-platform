import { redirect } from 'next/navigation';
import type { AdminStudent, Profile } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { AdminNav } from '@/components/admin/admin-nav';

export default async function AdminStudentsPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;

  let profile: Profile | null = null;
  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch {
    profile = null;
  }
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'admin') redirect('/dashboard');

  let students: AdminStudent[] = [];
  let loadError: string | null = null;
  try {
    students = await apiFetch<AdminStudent[]>(
      `/api/admin/students${q ? `?q=${encodeURIComponent(q)}` : ''}`,
    );
  } catch (err) {
    loadError =
      err instanceof ApiError ? `Could not load students (${err.code})` : 'Could not reach the API';
  }

  return (
    <div className="min-h-screen">
      <AdminNav current="/admin/students" />

      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="anim-rise font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          People
        </p>
        <h1
          className="anim-clip mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1] tracking-[-0.02em]"
          style={{ animationDelay: '80ms' }}
        >
          Students
        </h1>

        <form method="get" className="mt-9 flex flex-wrap gap-3">
          <input
            name="q"
            defaultValue={q ?? ''}
            placeholder="Search by name or email"
            className="min-w-0 flex-1 border border-[var(--rule-strong)] bg-ink-800 px-4 py-2.5 text-sm outline-none transition-colors placeholder:text-bone-600 focus:border-track-dev"
          />
          <button
            type="submit"
            className="bg-bone-100 px-6 py-2.5 text-sm font-medium text-ink-900"
          >
            Search
          </button>
        </form>

        {loadError ? (
          <p
            role="alert"
            className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] text-bone-200"
          >
            {loadError}
          </p>
        ) : students.length === 0 ? (
          <p className="mt-12 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
            {q ? `No students matching “${q}”.` : 'No students yet.'}
          </p>
        ) : (
          <>
            <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
              {students.length} {students.length === 1 ? 'student' : 'students'}
              {students.length === 200 && ' · showing the first 200'}
            </p>

            <div className="mt-6 overflow-x-auto">
              <table className="w-full min-w-[42rem] border-collapse text-sm">
                <thead>
                  <tr className="border-y border-[var(--rule)] text-left">
                    {['Student', 'College', 'Enrolments', 'Completed', 'Paid'].map((h, i) => (
                      <th
                        key={h}
                        scope="col"
                        className={`py-3 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 ${i > 1 ? 'text-right' : ''}`}
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {students.map((s) => (
                    <tr
                      key={s.id}
                      className="border-b border-[var(--rule)] transition-colors hover:bg-ink-800/50"
                    >
                      <td className="py-4 pr-6">
                        <span className="block text-bone-100">{s.fullName || '—'}</span>
                        <span className="mt-0.5 block font-mono text-[11px] text-bone-600">
                          {s.email}
                        </span>
                      </td>
                      <td className="py-4 pr-6 text-bone-400">
                        {s.college || '—'}
                        {s.graduationYear && (
                          <span className="ml-2 font-mono text-[11px] text-bone-600">
                            ’{String(s.graduationYear).slice(2)}
                          </span>
                        )}
                      </td>
                      <td className="py-4 text-right font-mono tabular-nums text-bone-400">
                        {s.enrollmentCount}
                      </td>
                      <td className="py-4 text-right font-mono tabular-nums text-bone-400">
                        {s.completedCount}
                      </td>
                      <td className="py-4 text-right font-mono tabular-nums text-bone-200">
                        ₹{Math.round(s.totalPaidPaise / 100).toLocaleString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
