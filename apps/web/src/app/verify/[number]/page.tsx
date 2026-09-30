import Link from 'next/link';
import type { Metadata } from 'next';
import type { CertificateVerification } from '@internship/shared';
import { publicFetch, ApiError } from '@/lib/api';

export const metadata: Metadata = {
  title: 'Verify a certificate — Internship Platform',
  robots: { index: false },
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bone-100 px-6 py-16 text-ink-900">
      <div className="w-full max-w-xl">{children}</div>
    </main>
  );
}

export default async function VerifyPage({
  params,
}: {
  params: Promise<{ number: string }>;
}) {
  const { number } = await params;

  let cert: CertificateVerification | null = null;
  let status: 'ok' | 'not_found' | 'invalid' | 'error' = 'ok';

  try {
    cert = await publicFetch<CertificateVerification>(
      `/api/verify/${encodeURIComponent(number)}`,
    );
  } catch (err) {
    if (err instanceof ApiError) {
      status = err.status === 404 ? 'not_found' : err.status === 400 ? 'invalid' : 'error';
    } else {
      status = 'error';
    }
  }

  if (!cert) {
    const copy = {
      not_found: {
        head: 'No such certificate.',
        body: 'Nothing has been issued under that number. Check it against the PDF — the format is INTX-2026-DEV-00042.',
      },
      invalid: {
        head: 'That is not a certificate number.',
        body: 'Certificate numbers look like INTX-2026-DEV-00042.',
      },
      error: {
        head: 'Could not check that right now.',
        body: 'Something went wrong on our side. Please try again in a moment.',
      },
      ok: { head: '', body: '' },
    }[status];

    return (
      <Shell>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-600">
          Certificate verification
        </p>
        <h1 className="mt-5 font-display text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">
          {copy.head}
        </h1>
        <p className="mt-5 leading-relaxed text-ink-900/70">{copy.body}</p>
        <p className="mt-8 break-all font-mono text-[11px] text-bone-600">Queried: {number}</p>
        <Link
          href="/"
          className="mt-10 inline-block border-b border-ink-900/30 pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-900/70 transition-colors hover:border-ink-900 hover:text-ink-900"
        >
          Internship Platform →
        </Link>
      </Shell>
    );
  }

  const issued = new Date(cert.issuedAt).toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  });

  return (
    <Shell>
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-600">
        Certificate verification
      </p>

      {cert.revoked ? (
        <div className="mt-5 border-l-2 border-track-ops bg-track-ops/10 py-4 pl-5">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-track-ops">Revoked</p>
          <p className="mt-2 text-sm leading-relaxed text-ink-900/80">
            This certificate was issued but has since been revoked. It should not be
            treated as valid.
          </p>
        </div>
      ) : (
        <div className="mt-5 flex items-center gap-3">
          <span
            className="flex h-6 w-6 items-center justify-center rounded-full bg-track-qa text-[13px] text-bone-100"
            aria-hidden
          >
            ✓
          </span>
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-ink-900/70">
            Genuine · issued by Internship Platform
          </p>
        </div>
      )}

      <h1 className="anim-clip mt-9 font-display text-[clamp(2.25rem,7vw,4rem)] leading-[1] tracking-[-0.02em]">
        {cert.studentName}
      </h1>

      <p className="mt-5 font-display text-xl italic text-ink-900/60">
        completed the {cert.trackTitle} track
      </p>

      <dl className="mt-12 space-y-px border border-ink-900/15 bg-ink-900/15">
        {[
          ['Certificate no.', cert.certificateNumber],
          ['Issued', issued],
          ['Status', cert.revoked ? 'Revoked' : 'Valid'],
        ].map(([k, v]) => (
          <div key={k} className="flex flex-wrap gap-x-6 gap-y-1 bg-bone-100 px-5 py-4">
            <dt className="w-32 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
              {k}
            </dt>
            <dd className="font-mono text-[12px] text-ink-900/85">{v}</dd>
          </div>
        ))}
      </dl>

      <p className="mt-9 max-w-md text-sm leading-relaxed text-ink-900/60">
        Every certificate requires a project built by the student and reviewed by a
        person. This page is public — anyone with the number can check it, without
        an account.
      </p>

      <Link
        href="/"
        className="mt-8 inline-block border-b border-ink-900/30 pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-ink-900/70 transition-colors hover:border-ink-900 hover:text-ink-900"
      >
        Internship Platform →
      </Link>
    </Shell>
  );
}
