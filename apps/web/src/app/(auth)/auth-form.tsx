'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function AuthForm({ mode }: { mode: 'sign-in' | 'sign-up' }) {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPending(true);
    setError(null);

    const supabase = createBrowserSupabase();
    const { error: authError } =
      mode === 'sign-up'
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
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <h1 className="mb-6 text-2xl font-semibold tracking-tight">
        {mode === 'sign-up' ? 'Create your account' : 'Welcome back'}
      </h1>

      <form onSubmit={onSubmit} className="flex flex-col gap-4">
        {mode === 'sign-up' && (
          <label className="flex flex-col gap-1.5 text-sm">
            Full name
            <input
              required
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
            />
          </label>
        )}

        <label className="flex flex-col gap-1.5 text-sm">
          Email
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        <label className="flex flex-col gap-1.5 text-sm">
          Password
          <input
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="rounded-lg border border-slate-700 bg-slate-900 px-3 py-2"
          />
        </label>

        {error && (
          <p role="alert" className="text-sm text-red-400">
            {error}
          </p>
        )}

        <button
          type="submit"
          disabled={pending}
          className="rounded-lg bg-indigo-500 px-4 py-2 font-medium disabled:opacity-50"
        >
          {pending ? 'Working…' : mode === 'sign-up' ? 'Create account' : 'Sign in'}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-400">
        {mode === 'sign-up' ? (
          <>
            Already have an account?{' '}
            <Link href="/sign-in" className="underline">
              Sign in
            </Link>
          </>
        ) : (
          <>
            No account?{' '}
            <Link href="/sign-up" className="underline">
              Create one
            </Link>
          </>
        )}
      </p>
    </main>
  );
}
