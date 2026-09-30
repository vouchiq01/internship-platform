import Link from 'next/link';
import { TRACKS } from '@/lib/tracks';
import { Reveal } from './reveal';

export function Tracks() {
  return (
    <section id="tracks" className="scroll-mt-14 border-t border-[var(--rule)] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <div className="flex items-end justify-between gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
                Section 02 — Tracks
              </p>
              <h2 className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em]">
                Four ways in.
              </h2>
            </div>
            <p className="hidden max-w-xs text-sm leading-relaxed text-bone-400 md:block">
              Each track ends in a different project. The review standard is the same.
            </p>
          </div>
        </Reveal>

        <div className="mt-14 grid gap-px border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-2">
          {TRACKS.map((track, i) => (
            <Reveal key={track.code} delay={i * 90}>
              <Link
                href={`/tracks/${track.slug}`}
                className="group relative block h-full bg-ink-900 p-8 transition-colors duration-500 hover:bg-ink-800 sm:p-10"
              >
                {/* Index edge — grows on hover like pulling a file from a drawer */}
                <span
                  className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-[0.14] transition-transform duration-[650ms] ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-y-100"
                  style={{ background: track.accent }}
                  aria-hidden
                />

                <div className="flex items-baseline justify-between">
                  <span
                    className="font-mono text-[11px] uppercase tracking-[0.2em]"
                    style={{ color: track.accent }}
                  >
                    {track.code}
                  </span>
                  <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                    {String(i + 1).padStart(2, '0')}
                  </span>
                </div>

                <h3 className="mt-6 font-display text-3xl leading-tight tracking-[-0.01em] sm:text-4xl">
                  {track.title}
                </h3>

                <p className="mt-4 max-w-sm text-[15px] leading-relaxed text-bone-400">
                  {track.blurb}
                </p>

                <dl className="mt-8 flex flex-wrap gap-x-8 gap-y-3 border-t border-[var(--rule)] pt-5 font-mono text-[10px] uppercase tracking-[0.12em]">
                  <div className="flex gap-2">
                    <dt className="text-bone-600">Weeks</dt>
                    <dd className="text-bone-200">{track.weeks}</dd>
                  </div>
                  <div className="flex gap-2">
                    <dt className="text-bone-600">Modules</dt>
                    <dd className="text-bone-200">{track.modules}</dd>
                  </div>
                </dl>

                <p className="mt-5 flex items-center gap-2 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                  <span>Project — {track.project}</span>
                  <span className="inline-block transition-transform duration-500 group-hover:translate-x-1.5">
                    →
                  </span>
                </p>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
