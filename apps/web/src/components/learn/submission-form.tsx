'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

const FIELD =
  'w-full border border-[var(--rule-strong)] bg-ink-800 px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-bone-600 focus:border-track-dev';
const LABEL = 'font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400';

export function SubmissionForm({ enrollmentId }: { enrollmentId: string }) {
  const router = useRouter();
  const [githubUrl, setGithubUrl] = useState('');
  const [liveUrl, setLiveUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) {
      router.push('/sign-in');
      return;
    }

    const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/api/submissions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ enrollmentId, githubUrl, liveUrl, notes }),
    });

    setPending(false);

    if (!res.ok) {
      const body = await res.json().catch(() => null);
      setError(body?.error?.message ?? 'Could not submit your project');
      return;
    }

    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      <label className="flex flex-col gap-2">
        <span className={LABEL}>GitHub repository</span>
        <input
          required
          type="url"
          placeholder="https://github.com/you/project"
          value={githubUrl}
          onChange={(e) => setGithubUrl(e.target.value)}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>Live URL — optional</span>
        <input
          type="url"
          placeholder="https://your-project.vercel.app"
          value={liveUrl}
          onChange={(e) => setLiveUrl(e.target.value)}
          className={FIELD}
        />
      </label>

      <label className="flex flex-col gap-2">
        <span className={LABEL}>Anything the reviewer should know — optional</span>
        <textarea
          rows={4}
          maxLength={2000}
          placeholder="Known gaps, decisions you made, where to start reading."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          className={`${FIELD} resize-y`}
        />
      </label>

      {error && (
        <p
          role="alert"
          className="border-l-2 border-track-ops bg-track-ops/10 px-4 py-3 font-mono text-[11px] leading-relaxed text-bone-200"
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="group relative self-start overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900 disabled:opacity-60"
      >
        <span className="relative z-10">{pending ? 'Submitting…' : 'Submit for review'}</span>
        <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100 group-disabled:scale-x-0" />
      </button>
    </form>
  );
}
