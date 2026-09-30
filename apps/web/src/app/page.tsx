import Link from 'next/link';

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center gap-6 px-6">
      <h1 className="text-4xl font-semibold tracking-tight">Internship Platform</h1>
      <p className="text-slate-400">
        Phase 1 skeleton. Tracks and enrolment arrive in Phase 2.
      </p>
      <div className="flex gap-3">
        <Link href="/sign-in" className="rounded-lg bg-indigo-500 px-4 py-2 font-medium">
          Sign in
        </Link>
        <Link href="/sign-up" className="rounded-lg border border-slate-700 px-4 py-2">
          Create account
        </Link>
      </div>
    </main>
  );
}
