import Link from 'next/link';

export function Nav() {
  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--rule)] bg-ink-900/70 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-6">
        <Link href="/" className="flex items-baseline gap-2.5">
          <span className="font-display text-xl leading-none">Internship</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
            /2026
          </span>
        </Link>

        <nav className="flex items-center gap-7 font-mono text-[11px] uppercase tracking-[0.14em]">
          <a href="#tracks" className="hidden text-bone-400 transition-colors hover:text-bone-100 sm:block">
            Tracks
          </a>
          <a href="#process" className="hidden text-bone-400 transition-colors hover:text-bone-100 sm:block">
            Process
          </a>
          <a href="#pricing" className="hidden text-bone-400 transition-colors hover:text-bone-100 sm:block">
            Pricing
          </a>
          <Link
            href="/sign-in"
            className="border border-[var(--rule-strong)] px-3.5 py-1.5 transition-colors hover:border-bone-100 hover:bg-bone-100 hover:text-ink-900"
          >
            Sign in
          </Link>
        </nav>
      </div>
    </header>
  );
}
