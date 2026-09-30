import Link from 'next/link';
import { TRACKS } from '@/lib/tracks';

export function Hero() {
  return (
    <section className="relative overflow-hidden pt-32 pb-24 sm:pt-40 sm:pb-32">
      <div className="draft-grid pointer-events-none absolute inset-0" aria-hidden />

      <div className="relative mx-auto max-w-6xl px-6">
        {/* Dossier header — the device that sets the whole tone */}
        <div
          className="anim-rise flex flex-wrap items-center gap-x-5 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400"
          style={{ animationDelay: '80ms' }}
        >
          <span className="text-bone-100">Dossier 01</span>
          <span className="h-px w-8 bg-[var(--rule-strong)]" />
          <span>04 Tracks</span>
          <span className="h-px w-8 bg-[var(--rule-strong)]" />
          <span>Cohort 2026</span>
          <span className="h-px w-8 bg-[var(--rule-strong)]" />
          <span>Verified Credential</span>
        </div>

        <h1 className="mt-8 max-w-4xl font-display text-[clamp(2.75rem,8vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
          <span className="anim-clip block" style={{ animationDelay: '180ms' }}>
            Not another
          </span>
          <span className="anim-clip block" style={{ animationDelay: '300ms' }}>
            certificate you
          </span>
          <span className="anim-clip block italic text-bone-400" style={{ animationDelay: '420ms' }}>
            bought online.
          </span>
        </h1>

        <div
          className="anim-rule mt-10 h-px w-full bg-[var(--rule-strong)]"
          style={{ animationDelay: '560ms' }}
        />

        <div className="mt-10 grid gap-10 lg:grid-cols-[1.1fr_0.9fr]">
          <p
            className="anim-rise max-w-xl text-lg leading-relaxed text-bone-200/85"
            style={{ animationDelay: '640ms' }}
          >
            You watch the lessons, then you build one real project. A human reads
            your code and either passes it or tells you what to fix. Only then do
            you get a certificate — and it carries a link anyone can check.
          </p>

          <div className="anim-rise" style={{ animationDelay: '740ms' }}>
            <dl className="grid grid-cols-3 gap-px border border-[var(--rule)] bg-[var(--rule)]">
              {[
                ['08', 'weeks, typical'],
                ['01', 'project, reviewed'],
                ['∞', 'public verification'],
              ].map(([figure, label]) => (
                <div key={label} className="bg-ink-900 px-4 py-5">
                  <dt className="font-display text-3xl leading-none">{figure}</dt>
                  <dd className="mt-2 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-400">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </div>

        <div
          className="anim-rise mt-12 flex flex-wrap items-center gap-4"
          style={{ animationDelay: '840ms' }}
        >
          <Link
            href="#tracks"
            className="group relative overflow-hidden bg-bone-100 px-7 py-3.5 text-sm font-medium text-ink-900"
          >
            <span className="relative z-10">Choose your track</span>
            <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100" />
          </Link>
          <a
            href="#certificate"
            className="border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
          >
            See the certificate →
          </a>
        </div>

        {/* Track index strip — colour as filing system */}
        <div
          className="anim-rise mt-20 flex flex-wrap items-center gap-x-8 gap-y-3 border-t border-[var(--rule)] pt-6"
          style={{ animationDelay: '940ms' }}
        >
          {TRACKS.map((track) => (
            <span key={track.code} className="flex items-center gap-2.5">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: track.accent }}
                aria-hidden
              />
              <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
                {track.title}
              </span>
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
