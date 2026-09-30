'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

const FIELD =
  'w-full border border-[var(--rule-strong)] bg-ink-800 px-4 py-3 text-[15px] outline-none transition-colors placeholder:text-bone-600 focus:border-track-dev';

const LABEL =
  'font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const isSignUp = mode === 'sign-up';

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error: authError } = isSignUp
      ? await supabase.auth.signUp({
          email,
          password,
          options: { data: { full_name: fullName } },
        })
      : await supabase.auth.signInWithPassword({ email, password });

    setPending(false);
    if (authError) {
      setError(authError.message);
      return;
    }
    router.push('/dashboard');
    router.refresh();
  }

  return (
    <div className="relative grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="draft-grid pointer-events-none absolute inset-0 lg:w-1/2" aria-hidden />

      {/* Left — the document plate */}
      <aside className="relative hidden flex-col justify-between border-r border-[var(--rule)] p-12 lg:flex">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-2xl leading-none">Internship</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
            /2026
          </span>
        </Link>

        <div className="anim-rise" style={{ animationDelay: '120ms' }}>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
            {isSignUp ? 'Enrolment · Step 01' : 'Returning candidate'}
          </p>
          <p className="mt-5 max-w-sm font-display text-[2.75rem] leading-[1.02] tracking-[-0.02em]">
            {isSignUp ? (
              <>
                A certificate you
                <span className="block italic text-bone-400">actually earned.</span>
              </>
            ) : (
              <>
                Pick up where
                <span className="block italic text-bone-400">you left off.</span>
              </>
            )}
          </p>
        </div>

        <dl className="flex gap-10 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
          <div>
            <dt>Tracks</dt>
            <dd className="mt-1.5 text-bone-200">04</dd>
          </div>
          <div>
            <dt>Review</dt>
            <dd className="mt-1.5 text-bone-200">Human</dd>
          </div>
          <div>
            <dt>Verification</dt>
            <dd className="mt-1.5 text-bone-200">Public</dd>
          </div>
        </dl>
      </aside>

      {/* Right — the form */}
      <main className="relative flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-sm">
          <Link href="/" className="mb-10 inline-flex items-baseline gap-2.5 lg:hidden">
            <span className="font-display text-2xl leading-none">Internship</span>
            <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
              /2026
            </span>
          </Link>

          <p className="anim-rise font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
            {isSignUp ? 'Create account' : 'Sign in'}
          </p>
          <h1
            className="anim-clip mt-3 font-display text-4xl leading-tight tracking-[-0.02em]"
            style={{ animationDelay: '90ms' }}
          >
            {isSignUp ? 'Start your track.' : 'Welcome back.'}
          </h1>
          <div
            className="anim-rule mt-7 h-px w-full bg-[var(--rule-strong)]"
            style={{ animationDelay: '200ms' }}
          />

          <form
            onSubmit={onSubmit}
            className="anim-rise mt-8 flex flex-col gap-5"
            style={{ animationDelay: '260ms' }}
          >
            {isSignUp && (
              <label className="flex flex-col gap-2">
                <span className={LABEL}>Full name</span>
                <input
                  required
                  autoComplete="name"
                  placeholder="Asha Kumar"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className={FIELD}
                />
              </label>
            )}

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Email</span>
              <input
                type="email"
                required
                autoComplete="email"
                placeholder="you@college.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={FIELD}
              />
            </label>

            <label className="flex flex-col gap-2">
              <span className={LABEL}>Password</span>
              <input
                type="password"
                required
                minLength={8}
                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                placeholder="At least 8 characters"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={FIELD}
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
              className="group relative mt-1 overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900 disabled:opacity-50"
            >
              <span className="relative z-10">
                {pending ? 'Working…' : isSignUp ? 'Create account' : 'Sign in'}
              </span>
              <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100 group-disabled:scale-x-0" />
            </button>
          </form>

          <p
            className="anim-rise mt-8 border-t border-[var(--rule)] pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600"
            style={{ animationDelay: '340ms' }}
          >
            {isSignUp ? (
              <>
                Already enrolled?{' '}
                <Link href="/sign-in" className="text-bone-200 underline underline-offset-4 hover:text-bone-100">
                  Sign in
                </Link>
              </>
            ) : (
              <>
                No account yet?{' '}
                <Link href="/sign-up" className="text-bone-200 underline underline-offset-4 hover:text-bone-100">
                  Create one
                </Link>
              </>
            )}
          </p>
        </div>
      </main>
    </div>
  );
}
