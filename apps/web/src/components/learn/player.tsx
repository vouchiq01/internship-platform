'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import type { EnrollmentDetail } from '@internship/shared';
import { createBrowserSupabase } from '@/lib/supabase/client';
import { accentFor } from '@/lib/track-accent';
import { LessonRail } from './lesson-rail';

export function Player({ initial }: { initial: EnrollmentDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const accent = accentFor(initial.trackSlug);

  // Open on the first incomplete unlocked lesson — where the student left off.
  const firstOpen = useMemo(() => {
    const next = initial.lessons.find((l) => l.unlocked && !l.completed);
    return next?.id ?? initial.lessons[initial.lessons.length - 1]?.id ?? null;
  }, [initial.lessons]);

  const [activeId, setActiveId] = useState<string | null>(firstOpen);
  const active = initial.lessons.find((l) => l.id === activeId) ?? null;

  async function markComplete() {
    if (!active) return;
    setError(null);

    const supabase = createBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/sign-in');
      return;
    }

    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/lessons/${active.id}/complete`,
      { method: 'POST', headers: { Authorization: `Bearer ${session.access_token}` } },
    );

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Could not save your progress');
      return;
    }

    // Re-fetch from the server rather than mutating local state, so unlock
    // state always comes from the same authority that enforces it.
    startTransition(() => router.refresh());
  }

  return (
    <div className="mx-auto grid max-w-7xl gap-10 px-6 py-10 lg:grid-cols-[1fr_20rem] lg:gap-14">
      <div className="min-w-0">
        {active ? (
          <>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-600">
              <Link href="/dashboard" className="transition-colors hover:text-bone-100">
                Dashboard
              </Link>
              <span>/</span>
              <span style={{ color: accent }}>{initial.trackTitle}</span>
            </div>

            <div className="mt-6 aspect-video w-full border border-[var(--rule)] bg-ink-800">
              {active.youtubeVideoId && active.youtubeVideoId !== 'PLACEHOLDER' ? (
                <iframe
                  key={active.id}
                  className="h-full w-full"
                  src={`https://www.youtube-nocookie.com/embed/${active.youtubeVideoId}?rel=0`}
                  title={active.title}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-600">
                    Video not yet published
                  </p>
                  <p className="max-w-sm text-sm text-bone-600">
                    This lesson has no video attached. An admin adds it from the
                    track editor.
                  </p>
                </div>
              )}
            </div>

            <h1 className="mt-8 font-display text-4xl leading-tight tracking-[-0.02em]">
              {active.title}
            </h1>
            {active.description && (
              <p className="mt-4 max-w-2xl leading-relaxed text-bone-400">
                {active.description}
              </p>
            )}

            {error && (
              <p
                role="alert"
                className="mt-6 border-l-2 border-track-ops bg-track-ops/10 px-4 py-3 font-mono text-[11px] text-bone-200"
              >
                {error}
              </p>
            )}

            <div className="mt-10 flex flex-wrap items-center gap-5 border-t border-[var(--rule)] pt-7">
              {active.completed ? (
                <span className="flex items-center gap-2.5 font-mono text-[11px] uppercase tracking-[0.14em]">
                  <span style={{ color: accent }}>✓</span>
                  <span className="text-bone-400">Completed</span>
                </span>
              ) : (
                <button
                  onClick={markComplete}
                  disabled={isPending}
                  className="group relative overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900 disabled:opacity-60"
                >
                  <span className="relative z-10">
                    {isPending ? 'Saving…' : 'Mark as complete'}
                  </span>
                  <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100 group-disabled:scale-x-0" />
                </button>
              )}

              {initial.projectUnlocked && (
                <Link
                  href={`/learn/${initial.id}/project`}
                  className="border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
                >
                  Go to the project →
                </Link>
              )}
            </div>
          </>
        ) : (
          <p className="font-mono text-[11px] uppercase tracking-[0.14em] text-bone-600">
            This track has no lessons yet.
          </p>
        )}
      </div>

      <aside className="lg:sticky lg:top-6 lg:self-start">
        <LessonRail
          lessons={initial.lessons}
          activeId={activeId}
          accent={accent}
          onSelect={setActiveId}
        />
      </aside>
    </div>
  );
}
