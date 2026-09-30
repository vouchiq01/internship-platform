import Link from 'next/link';
import type { Profile } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { SignOutButton } from './sign-out-button';

export default async function DashboardPage() {
  let profile: Profile | null = null;
  let loadError: string | null = null;

  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch (err) {
    loadError =
      err instanceof ApiError
        ? `Could not load your profile (${err.code})`
        : 'Could not reach the API';
  }

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
          <SignOutButton />
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

        {loadError ? (
          <p
            role="alert"
            className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] leading-relaxed text-bone-200"
          >
            {loadError}
          </p>
        ) : (
          <>
            <dl
              className="anim-rise mt-10 grid gap-px border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-3"
              style={{ animationDelay: '280ms' }}
            >
              {[
                ['Email', profile?.email ?? '—'],
                ['College', profile?.college ?? 'Not set'],
                ['Graduating', profile?.graduationYear?.toString() ?? 'Not set'],
              ].map(([label, value]) => (
                <div key={label} className="bg-ink-900 px-5 py-5">
                  <dt className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600">
                    {label}
                  </dt>
                  <dd className="mt-2 truncate text-[15px] text-bone-200">{value}</dd>
                </div>
              ))}
            </dl>

            <section
              className="anim-rise mt-10 border border-[var(--rule)] p-10 sm:p-14"
              style={{ animationDelay: '360ms' }}
            >
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                Enrolments — 00
              </p>
              <h2 className="mt-4 max-w-md font-display text-3xl leading-tight tracking-[-0.01em]">
                You have not started a track yet.
              </h2>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-bone-400">
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
          </>
        )}
      </main>
    </div>
  );
}
