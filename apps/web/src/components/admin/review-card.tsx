'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { ReviewQueueItem } from '@internship/shared';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function ReviewCard({ item }: { item: ReviewQueueItem }) {
  const router = useRouter();
  const [feedback, setFeedback] = useState('');
  const [mode, setMode] = useState<'idle' | 'rejecting'>('idle');
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function review(decision: 'approve' | 'reject') {
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/sign-in');
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/admin/submissions/${item.id}/review`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ decision, feedback }),
      },
    );

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Could not record the review');
      return;
    }

    router.refresh();
  }

  return (
    <article className="border border-[var(--rule)] bg-ink-900">
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-[var(--rule)] p-6">
        <div>
          <p className="font-display text-2xl leading-tight">{item.studentName}</p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
            {item.studentEmail}
          </p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400">
            {item.trackTitle}
          </p>
          <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
            Attempt {String(item.attemptNumber).padStart(2, '0')} ·{' '}
            {new Date(item.submittedAt).toLocaleDateString('en-IN', {
              day: '2-digit',
              month: 'short',
            })}
          </p>
        </div>
      </header>

      <div className="space-y-4 p-6">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600">
            Repository
          </p>
          <a
            href={item.githubUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1.5 block break-all font-mono text-[13px] text-track-dev underline underline-offset-4"
          >
            {item.githubUrl}
          </a>
        </div>

        {item.liveUrl && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600">Live</p>
            <a
              href={item.liveUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1.5 block break-all font-mono text-[13px] text-track-qa underline underline-offset-4"
            >
              {item.liveUrl}
            </a>
          </div>
        )}

        {item.notes && (
          <div>
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-600">
              Student notes
            </p>
            <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-bone-200/80">
              {item.notes}
            </p>
          </div>
        )}
      </div>

      <footer className="border-t border-[var(--rule)] p-6">
        {mode === 'rejecting' ? (
          <div className="flex flex-col gap-4">
            <label className="flex flex-col gap-2">
              <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400">
                Why is it not passing? The student sees this.
              </span>
              <textarea
                autoFocus
                rows={4}
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                placeholder="Be specific enough that they can act on it."
                className="w-full resize-y border border-[var(--rule-strong)] bg-ink-800 px-4 py-3 text-sm outline-none transition-colors placeholder:text-bone-600 focus:border-track-ops"
              />
            </label>
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => review('reject')}
                disabled={pending || feedback.trim().length < 10}
                className="bg-track-ops px-6 py-2.5 text-sm font-medium text-ink-900 disabled:opacity-40"
              >
                {pending ? 'Sending…' : 'Send rejection'}
              </button>
              <button
                onClick={() => setMode('idle')}
                disabled={pending}
                className="border border-[var(--rule-strong)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:text-bone-100"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => review('approve')}
              disabled={pending}
              className="bg-track-qa px-6 py-2.5 text-sm font-medium text-ink-900 disabled:opacity-50"
            >
              {pending ? 'Working…' : 'Approve'}
            </button>
            <button
              onClick={() => setMode('rejecting')}
              disabled={pending}
              className="border border-[var(--rule-strong)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-track-ops hover:text-track-ops"
            >
              Request changes
            </button>
          </div>
        )}

        {error && (
          <p role="alert" className="mt-4 font-mono text-[11px] text-track-ops">
            {error}
          </p>
        )}
      </footer>
    </article>
  );
}
