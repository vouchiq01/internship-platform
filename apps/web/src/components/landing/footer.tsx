import Link from 'next/link';

export function Footer() {
  return (
    <footer className="border-t border-[var(--rule)] py-14">
      <div className="mx-auto max-w-6xl px-6">
        <div className="flex flex-wrap items-end justify-between gap-8">
          <div>
            <p className="font-display text-3xl leading-none">Internship</p>
            <p className="mt-3 max-w-xs text-sm leading-relaxed text-bone-600">
              Engineering internships that end in something a recruiter can verify.
            </p>
          </div>

          <nav className="flex flex-wrap gap-x-8 gap-y-3 font-mono text-[10px] uppercase tracking-[0.16em] text-bone-400">
            <a href="#tracks" className="transition-colors hover:text-bone-100">Tracks</a>
            <a href="#pricing" className="transition-colors hover:text-bone-100">Pricing</a>
            <Link href="/verify" className="transition-colors hover:text-bone-100">Verify</Link>
            <Link href="/sign-in" className="transition-colors hover:text-bone-100">Sign in</Link>
          </nav>
        </div>

        <div className="mt-12 flex flex-wrap items-center justify-between gap-4 border-t border-[var(--rule)] pt-6 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
          <span>© 2026 Internship Platform</span>
          <span>Made in India</span>
        </div>
      </div>
    </footer>
  );
}
