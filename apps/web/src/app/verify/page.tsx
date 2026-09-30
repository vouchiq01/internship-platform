import Link from 'next/link';
import { redirect } from 'next/navigation';

async function lookup(formData: FormData) {
  'use server';
  const raw = String(formData.get('number') ?? '').trim().toUpperCase();
  if (!raw) return;
  redirect(`/verify/${encodeURIComponent(raw)}`);
}

export default function VerifyIndexPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-100 px-6 py-16 text-ink-900">
      <div className="w-full max-w-md">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-600">
          Certificate verification
        </p>
        <h1 className="mt-5 font-display text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">
          Check a certificate.
        </h1>
        <p className="mt-5 leading-relaxed text-ink-900/70">
          Enter the number printed on the certificate. No account needed.
        </p>

        <form action={lookup} className="mt-9 flex flex-col gap-4">
          <label className="flex flex-col gap-2">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-600">
              Certificate number
            </span>
            <input
              name="number"
              required
              placeholder="INTX-2026-DEV-00042"
              className="w-full border border-ink-900/25 bg-bone-200 px-4 py-3 font-mono text-sm uppercase tracking-wide outline-none transition-colors placeholder:text-bone-600 focus:border-ink-900"
            />
          </label>
          <button
            type="submit"
            className="self-start bg-ink-900 px-7 py-3.5 text-sm font-medium text-bone-100 transition-opacity hover:opacity-90"
          >
            Verify
          </button>
        </form>

        <Link
          href="/"
          className="mt-12 inline-block border-b border-ink-900/30 pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-900/70 transition-colors hover:border-ink-900 hover:text-ink-900"
        >
          Internship Platform →
        </Link>
      </div>
    </main>
  );
}
