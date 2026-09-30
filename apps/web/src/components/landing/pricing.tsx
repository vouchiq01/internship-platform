import Link from 'next/link';
import { Reveal } from './reveal';

const INCLUDED = [
  'All video modules for one track',
  'The project brief and submission',
  'Human code review, with written feedback',
  'Unlimited resubmissions until you pass',
  'PDF certificate and a permanent verify link',
  'Lifetime access — no renewal',
];

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-14 border-t border-[var(--rule)] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
            Section 05 — Pricing
          </p>
          <h2 className="mt-4 font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em]">
            One price, one track.
          </h2>
        </Reveal>

        <Reveal delay={120}>
          <div className="mt-14 grid gap-px border border-[var(--rule)] bg-[var(--rule)] lg:grid-cols-[1fr_1fr]">
            <div className="relative overflow-hidden bg-ink-800 p-10 sm:p-14">
              <span
                className="absolute left-0 top-0 h-full w-[3px] bg-track-dev"
                aria-hidden
              />

              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                Launch offer · per track
              </p>

              <div className="mt-7 flex flex-wrap items-baseline gap-x-5 gap-y-2">
                <span className="font-display text-[clamp(3.5rem,10vw,5.5rem)] leading-none tracking-[-0.03em]">
                  ₹1,999
                </span>
                <span className="font-mono text-lg text-bone-600 line-through decoration-track-ops/70 decoration-2">
                  ₹6,000
                </span>
              </div>

              <p className="mt-4 font-mono text-[10px] uppercase tracking-[0.14em] text-track-ops">
                Save ₹4,001 · 67% off
              </p>

              <p className="mt-8 max-w-sm text-[15px] leading-relaxed text-bone-400">
                Paid once, up front. There is no subscription, nothing charged at
                the end, and no separate fee for the certificate.
              </p>

              <Link
                href="#tracks"
                className="group relative mt-10 inline-block overflow-hidden bg-bone-100 px-8 py-4 text-sm font-medium text-ink-900"
              >
                <span className="relative z-10">Enrol now</span>
                <span className="absolute inset-0 origin-left scale-x-0 bg-track-dev transition-transform duration-500 ease-[cubic-bezier(0.16,0.84,0.28,1)] group-hover:scale-x-100" />
              </Link>
            </div>

            <div className="bg-ink-900 p-10 sm:p-14">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                What is included
              </p>

              <ul className="mt-8 space-y-px">
                {INCLUDED.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-4 border-t border-[var(--rule)] py-4 text-[15px] leading-relaxed text-bone-200/85"
                  >
                    <span className="mt-2 h-1.5 w-1.5 shrink-0 bg-track-qa" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>

              <p className="mt-8 border-t border-[var(--rule)] pt-6 font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-600">
                Payments processed by Razorpay · UPI, cards, netbanking, wallets
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
