'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function SignOutButton() {
  const router = useRouter();

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    router.push('/');
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="border border-[var(--rule-strong)] px-3.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:bg-bone-100 hover:text-ink-900"
    >
      Sign out
    </button>
  );
}
