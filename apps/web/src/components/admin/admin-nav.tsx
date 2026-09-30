import Link from 'next/link';

const LINKS = [
  ['/admin/reports', 'Reports'],
  ['/admin/review', 'Review queue'],
  ['/admin/tracks', 'Tracks'],
  ['/admin/students', 'Students'],
] as const;

export function AdminNav({ current }: { current: string }) {
  return (
    <header className="border-b border-[var(--rule)]">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-4 px-6 py-4">
        <Link href="/dashboard" className="flex items-baseline gap-2.5">
          <span className="font-display text-xl leading-none">Internship</span>
          <span className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
            /admin
          </span>
        </Link>

        <nav className="flex flex-wrap gap-x-6 gap-y-2 font-mono text-[11px] uppercase tracking-[0.14em]">
          {LINKS.map(([href, label]) => (
            <Link
              key={href}
              href={href}
              aria-current={current === href ? 'page' : undefined}
              className={
                current === href
                  ? 'border-b border-bone-100 pb-0.5 text-bone-100'
                  : 'pb-0.5 text-bone-400 transition-colors hover:text-bone-100'
              }
            >
              {label}
            </Link>
          ))}
        </nav>
      </div>
    </header>
  );
}
