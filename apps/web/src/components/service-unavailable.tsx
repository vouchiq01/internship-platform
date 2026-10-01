import Link from 'next/link';

/**
 * Shown when our own backend could not be reached. Deliberately does not
 * blame the visitor or imply the thing they asked for does not exist.
 */
export function ServiceUnavailable({
  title = 'We could not load this just now.',
  body = 'Something on our side is not responding. It is not you, and nothing you did caused it.',
  backHref = '/',
  backLabel = 'Back to the home page',
}: {
  title?: string;
  body?: string;
  backHref?: string;
  backLabel?: string;
}) {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col justify-center px-6">
      <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
        Temporarily unavailable
      </p>
      <h1 className="mt-5 font-display text-[clamp(2rem,6vw,3.25rem)] leading-[1.02] tracking-[-0.02em]">
        {title}
      </h1>
      <p className="mt-5 max-w-md leading-relaxed text-bone-400">{body}</p>

      <div className="mt-10 flex flex-wrap items-center gap-5">
        <Link
          href={backHref}
          className="group relative overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900"
        >
          <span className="relative z-10">{backLabel}</span>
          <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100" />
        </Link>
        <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
          Refreshing often fixes it
        </span>
      </div>
    </main>
  );
}
