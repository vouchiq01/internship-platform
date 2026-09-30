import Link from 'next/link';
import type { EnrollmentWithTrack, Profile } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { accentFor, codeFor } from '@/lib/track-accent';
import { SignOutButton } from './sign-out-button';

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ payment?: string }>;
}) {
  const { payment } = await searchParams;

  const [profileResult, enrollmentsResult] = await Promise.allSettled([
    apiFetch<Profile>('/api/me'),
    apiFetch<EnrollmentWithTrack[]>('/api/enrollments'),
  ]);

  const profile = profileResult.status === 'fulfilled' ? profileResult.value : null;
  const enrollments =
    enrollmentsResult.status === 'fulfilled' ? enrollmentsResult.value : [];

  const loadError =
    profileResult.status === 'rejected'
      ? profileResult.reason instanceof ApiError
        ? `Could not load your profile (${profileResult.reason.code})`
        : 'Could not reach the API'
      : null;

  const displayName = profile?.fullName?.trim() || profile?.email || 'Candidate';

  return (
    <div className="relative min-h-screen">
      <div className="draft-grid pointer-events-none absolute inset-0 h-96" aria-hidden />

      <header className="relative border-b border-[var(--rule)]">
        <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-6">
          <Link href="/" className="flex items-baseline gap-2.5">
            <span className="font-display text-xl leading-none">Internship</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
              /2026
            </span>
          </Link>
          <div className="flex items-center gap-5">
            {profile?.role === 'admin' && (
              <Link
                href="/admin/review"
                className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:text-bone-100"
              >
                Review queue
              </Link>
            )}
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="relative mx-auto max-w-5xl px-6 py-16">
        <p className="anim-rise font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          Candidate file
        </p>
        <h1
          className="anim-clip mt-4 font-display text-[clamp(2.25rem,6vw,4rem)] leading-[1] tracking-[-0.02em]"
          style={{ animationDelay: '90ms' }}
        >
          {displayName}
        </h1>
        <div
          className="anim-rule mt-8 h-px w-full bg-[var(--rule-strong)]"
          style={{ animationDelay: '200ms' }}
        />

        {payment === 'processing' && (
          <div className="mt-10 border-l-2 border-track-dev bg-track-dev/10 px-5 py-4">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-track-dev">
              Confirming your payment
            </p>
            <p className="mt-2 text-sm leading-relaxed text-bone-200/85">
              Your bank has told us about the payment and we are waiting on the
              confirmation. Your track unlocks the moment it arrives — usually a
              few seconds. Refresh this page.
            </p>
          </div>
        )}

        {loadError ? (
          <p
            role="alert"
            className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] text-bone-200"
          >
            {loadError}
          </p>
        ) : enrollments.length === 0 ? (
          <section className="anim-rise mt-10 border border-[var(--rule)] p-10 sm:p-14" style={{ animationDelay: '300ms' }}>
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
              Enrolments — 00
            </p>
            <h2 className="mt-4 max-w-md font-display text-3xl leading-tight">
              You have not started a track yet.
            </h2>
            <p className="mt-4 max-w-md leading-relaxed text-bone-400">
              Four tracks are open for the 2026 cohort. Pick one and the modules
              unlock straight away.
            </p>
            <Link
              href="/#tracks"
              className="group relative mt-8 inline-block overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900"
            >
              <span className="relative z-10">Browse tracks</span>
              <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100" />
            </Link>
          </section>
        ) : (
          <>
            <p className="mt-10 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
              Enrolments — {String(enrollments.length).padStart(2, '0')}
            </p>

            <div className="mt-6 grid gap-px border border-[var(--rule)] bg-[var(--rule)]">
              {enrollments.map((e) => {
                const accent = accentFor(e.trackSlug);
                const pct =
                  e.lessonsTotal > 0
                    ? Math.round((e.lessonsCompleted / e.lessonsTotal) * 100)
                    : 0;

                return (
                  <article key={e.id} className="relative bg-ink-900 p-8 sm:p-10">
                    <span
                      className="absolute left-0 top-0 h-full w-[3px]"
                      style={{ background: accent }}
                      aria-hidden
                    />

                    <div className="flex flex-wrap items-start justify-between gap-4">
                      <div>
                        <span
                          className="font-mono text-[10px] uppercase tracking-[0.2em]"
                          style={{ color: accent }}
                        >
                          {codeFor(e.trackSlug)}
                        </span>
                        <h2 className="mt-3 font-display text-3xl leading-tight">
                          {e.trackTitle}
                        </h2>
                      </div>
                      <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                        {e.status === 'pending_payment'
                          ? 'Awaiting payment'
                          : e.status === 'completed'
                            ? 'Completed'
                            : 'In progress'}
                      </span>
                    </div>

                    {e.status !== 'pending_payment' && (
                      <div className="mt-7">
                        <div className="flex items-baseline justify-between font-mono text-[10px] uppercase tracking-[0.14em]">
                          <span className="text-bone-600">Progress</span>
                          <span className="text-bone-200">
                            {e.lessonsCompleted}/{e.lessonsTotal}
                          </span>
                        </div>
                        <div className="mt-2.5 h-[3px] w-full bg-[var(--rule)]">
                          <div
                            className="h-full transition-[width] duration-700"
                            style={{ width: `${pct}%`, background: accent }}
                          />
                        </div>
                      </div>
                    )}

                    <div className="mt-8 flex flex-wrap items-center gap-5">
                      {e.status === 'pending_payment' ? (
                        <Link
                          href={`/tracks/${e.trackSlug}`}
                          className="border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
                        >
                          Complete payment →
                        </Link>
                      ) : (
                        <Link
                          href={`/learn/${e.id}`}
                          className="group relative overflow-hidden bg-bone-100 px-6 py-3 text-sm font-medium text-ink-900"
                        >
                          <span className="relative z-10">
                            {e.lessonsCompleted === 0 ? 'Start' : 'Continue'}
                          </span>
                          <span
                            className="absolute inset-0 origin-left scale-x-0 transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100"
                            style={{ background: accent }}
                          />
                        </Link>
                      )}

                      {e.certificateNumber && (
                        <>
                          {e.certificatePdfUrl && (
                            <a
                              href={e.certificatePdfUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
                            >
                              Download certificate →
                            </a>
                          )}
                          <Link
                            href={`/verify/${e.certificateNumber}`}
                            className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600 transition-colors hover:text-bone-100"
                          >
                            {e.certificateNumber}
                          </Link>
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
