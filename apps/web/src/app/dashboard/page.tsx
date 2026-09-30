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

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <header className="mb-10 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
        <SignOutButton />
      </header>

      {loadError ? (
        <p role="alert" className="text-red-400">
          {loadError}
        </p>
      ) : (
        <div className="rounded-xl border border-slate-800 bg-slate-900/50 p-6">
          <p className="text-lg font-medium">{profile?.fullName || profile?.email}</p>
          <p className="text-sm text-slate-400">{profile?.email}</p>
          <p className="mt-4 text-sm text-slate-400">
            You are not enrolled in any track yet. Tracks arrive in Phase 2.
          </p>
        </div>
      )}
    </main>
  );
}
