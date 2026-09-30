import { redirect } from 'next/navigation';
import type { Profile, Track } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { AdminNav } from '@/components/admin/admin-nav';
import { TrackEditor } from '@/components/admin/track-editor';

export default async function AdminTracksPage() {
  let profile: Profile | null = null;
  try {
    profile = await apiFetch<Profile>('/api/me');
  } catch {
    profile = null;
  }
  if (!profile) redirect('/sign-in');
  if (profile.role !== 'admin') redirect('/dashboard');

  let tracks: Track[] = [];
  let loadError: string | null = null;
  try {
    tracks = await apiFetch<Track[]>('/api/admin/tracks');
  } catch (err) {
    loadError =
      err instanceof ApiError ? `Could not load tracks (${err.code})` : 'Could not reach the API';
  }

  return (
    <div className="min-h-screen">
      <AdminNav current="/admin/tracks" />

      <main className="mx-auto max-w-5xl px-6 py-14">
        <p className="anim-rise font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          Catalogue
        </p>
        <h1
          className="anim-clip mt-4 font-display text-[clamp(2rem,5vw,3.25rem)] leading-[1] tracking-[-0.02em]"
          style={{ animationDelay: '80ms' }}
        >
          Tracks
        </h1>

        {loadError ? (
          <p
            role="alert"
            className="mt-10 border-l-2 border-track-ops bg-track-ops/10 px-5 py-4 font-mono text-[12px] text-bone-200"
          >
            {loadError}
          </p>
        ) : (
          <div className="mt-10">
            <TrackEditor tracks={tracks} />
          </div>
        )}
      </main>
    </div>
  );
}
