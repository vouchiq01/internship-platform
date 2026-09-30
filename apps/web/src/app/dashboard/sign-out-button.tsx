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
      className="rounded-lg border border-slate-700 px-3 py-1.5 text-sm"
    >
      Sign out
    </button>
  );
}
