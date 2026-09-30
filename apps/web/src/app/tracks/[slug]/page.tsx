import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { TrackDetail } from '@internship/shared';
import { publicFetch, ApiError } from '@/lib/api';
import { accentFor, codeFor } from '@/lib/track-accent';
import { Nav } from '@/components/landing/nav';
import { Footer } from '@/components/landing/footer';
import { Curriculum } from '@/components/track/curriculum';
import { EnrolButton } from '@/components/track/enrol-button';

export default async function TrackPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;

  let track: TrackDetail;
  try {
    track = await publicFetch<TrackDetail>(`/api/tracks/${slug}`);
  } catch (err) {
    if (err instanceof ApiError && err.status === 404) notFound();
    throw err;
  }

  const accent = accentFor(track.slug);
  const code = codeFor(track.slug);
  const saving = track.listPriceInr ? track.listPriceInr - track.priceInr : null;

  return (
    <>
      <Nav />

      <main>
        <section className="relative overflow-hidden border-b border-[var(--rule)] pt-32 pb-20 sm:pt-40">
          <div className="draft-grid pointer-events-none absolute inset-0" aria-hidden />

          <div className="relative mx-auto max-w-6xl px-6">
            <div className="anim-rise flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.22em]">
              <Link href="/#tracks" className="text-bone-600 transition-colors hover:text-bone-100">
                Tracks
              </Link>
              <span className="text-bone-600">/</span>
              <span style={{ color: accent }}>{code}</span>
            </div>

            <h1
              className="anim-clip mt-7 max-w-3xl font-display text-[clamp(2.5rem,7vw,5rem)] leading-[0.96] tracking-[-0.02em]"
              style={{ animationDelay: '120ms' }}
            >
              {track.title}
            </h1>

            <p
              className="anim-rise mt-7 max-w-xl text-lg leading-relaxed text-bone-200/85"
              style={{ animationDelay: '240ms' }}
            >
              {track.description}
            </p>

            <dl
              className="anim-rise mt-12 grid max-w-2xl gap-px border border-[var(--rule)] bg-[var(--rule)] sm:grid-cols-3"
              style={{ animationDelay: '320ms' }}
            >
              {[
                [String(track.durationWeeks).padStart(2, '0'), 'weeks'],
                [String(track.lessons.length).padStart(2, '0'), 'modules'],
                ['01', 'reviewed project'],
              ].map(([figure, label]) => (
                <div key={label} className="bg-ink-900 px-5 py-5">
                  <dt className="font-display text-3xl leading-none">{figure}</dt>
                  <dd className="mt-2 font-mono text-[10px] uppercase tracking-[0.12em] text-bone-400">
                    {label}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        <div className="mx-auto max-w-6xl px-6">
          <div className="grid gap-16 py-20 lg:grid-cols-[1.35fr_0.65fr] lg:gap-20">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
                Curriculum
              </p>
              <h2 className="mt-4 mb-10 font-display text-4xl leading-tight tracking-[-0.02em]">
                What you will work through.
              </h2>
              <Curriculum lessons={track.lessons} accent={accent} />

              {track.project && (
                <section className="mt-20">
                  <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
                    The project
                  </p>
                  <h2 className="mt-4 font-display text-4xl leading-tight tracking-[-0.02em]">
                    {track.project.title}
                  </h2>

                  <div className="mt-7 space-y-4 border-l-2 pl-6" style={{ borderColor: accent }}>
                    {track.project.briefMarkdown.split('\n\n').map((para, i) => (
                      <p key={i} className="max-w-xl leading-relaxed text-bone-200/80">
                        {para}
                      </p>
                    ))}
                  </div>

                  <div className="mt-10 border border-[var(--rule)] p-7">
                    <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
                      To pass review, it must have
                    </p>
                    <ul className="mt-5 space-y-3">
                      {track.project.requirements
                        .split('\n')
                        .filter((line) => line.trim().startsWith('-'))
                        .map((line, i) => (
                          <li key={i} className="flex items-start gap-3.5 text-[15px] leading-relaxed text-bone-200/80">
                            <span
                              className="mt-2 h-1.5 w-1.5 shrink-0"
                              style={{ background: accent }}
                              aria-hidden
                            />
                            {line.replace(/^-\s*/, '')}
                          </li>
                        ))}
                    </ul>
                  </div>
                </section>
              )}
            </div>

            {/* Sticky enrolment panel */}
            <aside className="lg:sticky lg:top-24 lg:self-start">
              <div className="relative overflow-hidden border border-[var(--rule)] bg-ink-800 p-8">
                <span
                  className="absolute left-0 top-0 h-full w-[3px]"
                  style={{ background: accent }}
                  aria-hidden
                />

                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                  Launch offer
                </p>

                <div className="mt-5 flex flex-wrap items-baseline gap-x-4 gap-y-1">
                  <span className="font-display text-5xl leading-none tracking-[-0.03em]">
                    ₹{track.priceInr.toLocaleString('en-IN')}
                  </span>
                  {track.listPriceInr && (
                    <span className="font-mono text-base text-bone-600 line-through decoration-track-ops/70 decoration-2">
                      ₹{track.listPriceInr.toLocaleString('en-IN')}
                    </span>
                  )}
                </div>

                {saving !== null && saving > 0 && (
                  <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-track-ops">
                    Save ₹{saving.toLocaleString('en-IN')}
                  </p>
                )}

                <p className="mt-6 text-sm leading-relaxed text-bone-400">
                  Paid once. No subscription, and nothing charged when you collect
                  your certificate.
                </p>

                <div className="mt-8">
                  <EnrolButton
                    trackId={track.id}
                    trackTitle={track.title}
                    priceInr={track.priceInr}
                  />
                </div>

                <ul className="mt-8 space-y-3 border-t border-[var(--rule)] pt-6">
                  {[
                    'All modules for this track',
                    'Human review, with written feedback',
                    'Unlimited resubmissions',
                    'Verifiable certificate',
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-3 text-sm leading-relaxed text-bone-400">
                      <span className="mt-1.5 h-1 w-1 shrink-0 bg-track-qa" aria-hidden />
                      {item}
                    </li>
                  ))}
                </ul>

                <p className="mt-7 border-t border-[var(--rule)] pt-5 font-mono text-[9px] uppercase leading-relaxed tracking-[0.12em] text-bone-600">
                  Razorpay · UPI, cards, netbanking
                </p>
              </div>
            </aside>
          </div>
        </div>
      </main>

      <Footer />
    </>
  );
}
