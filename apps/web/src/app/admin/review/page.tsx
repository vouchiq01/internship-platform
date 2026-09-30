import Link from 'next/link';
import { redirect } from 'next/navigation';
import type { Profile, ReviewQueueItem } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { ReviewCard } from '@/components/admin/review-card';

export default async function AdminReviewPage() {
  // The API enforces admin access too; this redirect only avoids showing an
  // error page to a student who guessed the URL.
  //
  // redirect() works by throwing a control-flow signal, so it must never be
  // called inside a try block — the catch would swallow it.
  let profile: Profile | null = null;
  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch {
    profile = null;
  }
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'admin') redirect('/dashboard');

  let queue: ReviewQueueItem[] = [];
  let loadError: string | null = null;
  try {
    queue = await apiFetch<ReviewQueueItem[]>('/api/admin/submissions');
  } catch (err) {
    loadError =
      err instanceof ApiError ? `Could not load the queue (${err.code})` : 'Could not reach the API';
  }

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-600">
        <Link href="/dashboard" className="transition-colors hover:text-bone-100">
          Dashboard
        </Link>
        <span>/</span>
        <span className="text-bone-400">Admin</span>
      </div>

      <h1 className="anim-clip mt-7 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1] tracking-[-0.02em]">
        Review queue
      </h1>
      <div className="anim-rule mt-8 h-px w-full bg-[var(--rule-strong)]" />

      {loadError ? (
        <p role="alert" className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] text-bone-200">
          {loadError}
        </p>
      ) : queue.length === 0 ? (
        <div className="mt-10 border border-[var(--rule)] p-10 text-center">
          <p className="font-display text-3xl leading-tight">Nothing waiting.</p>
          <p className="mt-3 text-sm text-bone-600">
            Submissions appear here the moment a student sends one.
          </p>
        </div>
      ) : (
        <>
          <p className="mt-8 font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
            {queue.length} pending · oldest first
          </p>
          <div className="mt-6 flex flex-col gap-6">
            {queue.map((item) => (
              <ReviewCard key={item.id} item={item} />
            ))}
          </div>
        </>
      )}
    </main>
  );
}
