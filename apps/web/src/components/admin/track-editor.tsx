'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import type { Track } from '@internship/shared';
import { createBrowserSupabase } from '@/lib/supabase/client';

const FIELD =
  'w-full border border-[var(--rule-strong)] bg-ink-800 px-3.5 py-2.5 text-sm outline-none transition-colors placeholder:text-bone-600 focus:border-track-dev';
const LABEL = 'font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400';

type Draft = {
  slug: string;
  title: string;
  description: string;
  priceInr: number;
  listPriceInr: number | null;
  durationWeeks: number;
  isPublished: boolean;
  sortOrder: number;
};

const blank: Draft = {
  slug: '',
  title: '',
  description: '',
  priceInr: 1999,
  listPriceInr: 6000,
  durationWeeks: 8,
  isPublished: false,
  sortOrder: 0,
};

export function TrackEditor({ tracks }: { tracks: Track[] }) {
  const router = useRouter();
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(blank);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function startNew() {
    setEditing('new');
    setDraft(blank);
    setError(null);
  }

  function startEdit(track: Track) {
    setEditing(track.id);
    setDraft({
      slug: track.slug,
      title: track.title,
      description: track.description,
      priceInr: track.priceInr,
      listPriceInr: track.listPriceInr,
      durationWeeks: track.durationWeeks,
      isPublished: track.isPublished,
      sortOrder: track.sortOrder,
    });
    setError(null);
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/sign-in');
      return;
    }

    const isNew = editing === 'new';
    const res = await fetch(
      `${process.env.NEXT_PUBLIC_API_URL}/api/admin/tracks${isNew ? '' : `/${editing}`}`,
      {
        method: isNew ? 'POST' : 'PUT',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(draft),
      },
    );

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Could not save the track');
      return;
    }

    setEditing(null);
    router.refresh();
  }

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
          {tracks.length} {tracks.length === 1 ? 'track' : 'tracks'}
        </p>
        <button
          onClick={startNew}
          className="bg-bone-100 px-5 py-2.5 text-sm font-medium text-ink-900"
        >
          New track
        </button>
      </div>

      {editing && (
        <form onSubmit={save} className="mt-7 border border-[var(--rule-strong)] bg-ink-800 p-7">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
            {editing === 'new' ? 'New track' : `Editing ${draft.slug}`}
          </p>

          <div className="mt-6 grid gap-5 sm:grid-cols-2">
            <label className="flex flex-col gap-2">
              <span className={LABEL}>Title</span>
              <input
                required
                value={draft.title}
                onChange={(e) => setDraft({ ...draft, title: e.target.value })}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Slug — lower-case, hyphens</span>
              <input
                required
                value={draft.slug}
                onChange={(e) => setDraft({ ...draft, slug: e.target.value })}
                placeholder="ai-engineering"
                className={`${FIELD} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-2 sm:col-span-2">
              <span className={LABEL}>Description</span>
              <textarea
                rows={3}
                value={draft.description}
                onChange={(e) => setDraft({ ...draft, description: e.target.value })}
                className={`${FIELD} resize-y`}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Price ₹ — what you charge</span>
              <input
                required
                type="number"
                min={0}
                value={draft.priceInr}
                onChange={(e) => setDraft({ ...draft, priceInr: Number(e.target.value) })}
                className={`${FIELD} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>List price ₹ — the struck-through anchor</span>
              <input
                type="number"
                min={0}
                value={draft.listPriceInr ?? ''}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    listPriceInr: e.target.value === '' ? null : Number(e.target.value),
                  })
                }
                className={`${FIELD} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Duration — weeks</span>
              <input
                required
                type="number"
                min={1}
                value={draft.durationWeeks}
                onChange={(e) => setDraft({ ...draft, durationWeeks: Number(e.target.value) })}
                className={`${FIELD} font-mono`}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Sort order</span>
              <input
                required
                type="number"
                min={0}
                value={draft.sortOrder}
                onChange={(e) => setDraft({ ...draft, sortOrder: Number(e.target.value) })}
                className={`${FIELD} font-mono`}
              />
            </label>

            <label className="flex items-center gap-3 sm:col-span-2">
              <input
                type="checkbox"
                checked={draft.isPublished}
                onChange={(e) => setDraft({ ...draft, isPublished: e.target.checked })}
                className="h-4 w-4 accent-[var(--color-track-qa)]"
              />
              <span className="text-sm text-bone-200">
                Published — visible to students and open for enrolment
              </span>
            </label>
          </div>

          {error && (
            <p
              role="alert"
              className="mt-5 border-l-2 border-track-ops bg-track-ops/10 px-4 py-3 font-mono text-[11px] text-bone-200"
            >
              {error}
            </p>
          )}

          <div className="mt-7 flex flex-wrap gap-3">
            <button
              type="submit"
              disabled={pending}
              className="bg-bone-100 px-6 py-2.5 text-sm font-medium text-ink-900 disabled:opacity-60"
            >
              {pending ? 'Saving…' : 'Save track'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="border border-[var(--rule-strong)] px-5 py-2.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:text-bone-100"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      <div className="mt-8 grid gap-px border border-[var(--rule)] bg-[var(--rule)]">
        {tracks.map((t) => (
          <div key={t.id} className="flex flex-wrap items-center justify-between gap-4 bg-ink-900 px-6 py-5">
            <div className="min-w-0">
              <div className="flex flex-wrap items-baseline gap-3">
                <span className="text-bone-100">{t.title}</span>
                <span className="font-mono text-[10px] text-bone-600">{t.slug}</span>
                {!t.isPublished && (
                  <span className="border border-[var(--rule-strong)] px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.12em] text-bone-600">
                    Draft
                  </span>
                )}
              </div>
              <p className="mt-1.5 font-mono text-[11px] text-bone-600">
                ₹{t.priceInr.toLocaleString('en-IN')}
                {t.listPriceInr && ` · was ₹${t.listPriceInr.toLocaleString('en-IN')}`}
                {` · ${t.durationWeeks}w`}
              </p>
            </div>

            <button
              onClick={() => startEdit(t)}
              className="border border-[var(--rule-strong)] px-4 py-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
            >
              Edit
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
