import Link from 'next/link';
import { Nav } from '@/components/landing/nav';

export default function TrackNotFound() {
  return (
    <>
      <Nav />
      <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
          Error 404
        </p>
        <h1 className="mt-5 font-display text-5xl leading-tight tracking-[-0.02em]">
          No such track.
        </h1>
        <p className="mt-5 max-w-md leading-relaxed text-bone-400">
          That track either does not exist or has not been published yet.
        </p>
        <Link
          href="/#tracks"
          className="mt-9 self-start border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
        >
          See all tracks →
        </Link>
      </main>
    </>
  );
}
