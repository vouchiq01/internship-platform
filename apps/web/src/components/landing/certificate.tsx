'use client';

import { useRef, type PointerEvent } from 'react';
import { Reveal } from './reveal';

export function Certificate() {
  const cardRef = useRef<HTMLDivElement>(null);

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const el = cardRef.current;
    if (!el) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width - 0.5;
    const py = (e.clientY - rect.top) / rect.height - 0.5;
    el.style.transform = `perspective(1400px) rotateY(${px * 7}deg) rotateX(${-py * 7}deg)`;
  }

  function onPointerLeave() {
    const el = cardRef.current;
    if (el) el.style.transform = 'perspective(1400px) rotateY(0deg) rotateX(0deg)';
  }

  return (
    <section
      id="certificate"
      className="scroll-mt-14 border-t border-[var(--rule)] bg-bone-100 py-24 text-ink-900 sm:py-32"
    >
      <div className="mx-auto max-w-6xl px-6">
        <div className="grid gap-16 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <Reveal>
            <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-600">
              Section 04 — The credential
            </p>
            <h2 className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em]">
              Anyone can check it.
              <span className="block italic text-bone-600">That is the whole point.</span>
            </h2>
            <p className="mt-6 max-w-md text-[15px] leading-relaxed text-ink-900/70">
              Every certificate carries a unique number and a public verification
              page. A recruiter opens the link, sees your name, your track and the
              date it was issued. No login, no PDF to forge, no phone call to us.
            </p>

            <dl className="mt-10 space-y-px border border-ink-900/15 bg-ink-900/15">
              {[
                ['Format', 'PDF download + public web page'],
                ['Identifier', 'INTX-2026-DEV-00042'],
                ['Revocable', 'Yes — shown as revoked, never deleted'],
              ].map(([k, v]) => (
                <div key={k} className="flex flex-wrap gap-x-6 gap-y-1 bg-bone-100 px-5 py-3.5">
                  <dt className="w-24 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
                    {k}
                  </dt>
                  <dd className="font-mono text-[11px] text-ink-900/80">{v}</dd>
                </div>
              ))}
            </dl>
          </Reveal>

          <Reveal delay={140}>
            <div
              ref={cardRef}
              onPointerMove={onPointerMove}
              onPointerLeave={onPointerLeave}
              className="guilloche relative border border-ink-900/25 bg-bone-200 p-8 shadow-[0_28px_70px_-28px_rgba(11,10,12,0.5)] transition-transform duration-300 ease-out sm:p-12"
            >
              <div className="border border-ink-900/20 p-7 sm:p-10">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.24em] text-bone-600">
                      Certificate of completion
                    </p>
                    <p className="mt-1 font-mono text-[9px] uppercase tracking-[0.18em] text-bone-600">
                      Internship Platform · 2026
                    </p>
                  </div>
                  <span
                    className="anim-seal flex h-14 w-14 shrink-0 items-center justify-center rounded-full border-2 border-track-dev/60 font-mono text-[8px] uppercase leading-tight tracking-[0.1em] text-track-dev"
                    style={{ animationDelay: '300ms' }}
                  >
                    Ver
                    <br />
                    ified
                  </span>
                </div>

                <p className="mt-10 font-mono text-[9px] uppercase tracking-[0.18em] text-bone-600">
                  This certifies that
                </p>
                <p className="mt-3 font-display text-4xl leading-tight tracking-[-0.01em] sm:text-5xl">
                  Asha Kumar
                </p>

                <p className="mt-7 font-mono text-[9px] uppercase tracking-[0.18em] text-bone-600">
                  completed the track
                </p>
                <p className="mt-2 font-display text-2xl italic leading-tight sm:text-3xl">
                  Development
                </p>

                <div className="mt-10 flex flex-wrap items-end justify-between gap-6 border-t border-ink-900/20 pt-5">
                  <div>
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-600">
                      Certificate no.
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-900">
                      INTX-2026-DEV-00042
                    </p>
                  </div>
                  <div className="sm:text-right">
                    <p className="font-mono text-[9px] uppercase tracking-[0.16em] text-bone-600">
                      Verify at
                    </p>
                    <p className="mt-1 font-mono text-[11px] tracking-wide text-ink-900">
                      /verify/INTX-2026-DEV-00042
                    </p>
                  </div>
                </div>
              </div>

              <p className="mt-5 text-center font-mono text-[9px] uppercase tracking-[0.2em] text-bone-600">
                Specimen — not a real credential
              </p>
            </div>
          </Reveal>
        </div>
      </div>
    </section>
  );
}
