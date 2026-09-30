import { Reveal } from './reveal';

const STEPS = [
  {
    n: '01',
    title: 'Enrol',
    body: 'Pick a track and pay once. No subscription, no auto-renewal, no upsell at the end.',
    note: 'Razorpay · UPI, card, netbanking',
  },
  {
    n: '02',
    title: 'Work through the lessons',
    body: 'Modules unlock in order so the sequence actually holds together. Go at your own pace.',
    note: 'Self-paced · no live sessions',
  },
  {
    n: '03',
    title: 'Build one real project',
    body: 'A brief, not a tutorial to copy. You push it to GitHub and submit the link.',
    note: 'Deliverable · public repository',
  },
  {
    n: '04',
    title: 'Get reviewed by a person',
    body: 'Someone reads your code. If it is not good enough you get written feedback and another attempt.',
    note: 'Rejection is a normal outcome',
  },
  {
    n: '05',
    title: 'Receive a verifiable certificate',
    body: 'A PDF, plus a public page at /verify that any recruiter can open without an account.',
    note: 'Permanent · independently checkable',
  },
];

export function Process() {
  return (
    <section id="process" className="scroll-mt-14 border-t border-[var(--rule)] py-24 sm:py-32">
      <div className="mx-auto max-w-6xl px-6">
        <Reveal>
          <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-bone-400">
            Section 03 — Process
          </p>
          <h2 className="mt-4 max-w-2xl font-display text-[clamp(2rem,5vw,3.5rem)] leading-[1] tracking-[-0.02em]">
            The part most platforms skip.
          </h2>
        </Reveal>

        <ol className="mt-16">
          {STEPS.map((step, i) => (
            <Reveal key={step.n} delay={i * 70}>
              <li className="group grid gap-x-8 gap-y-3 border-t border-[var(--rule)] py-8 transition-colors duration-500 hover:bg-ink-800/40 sm:grid-cols-[4rem_1fr_14rem] sm:py-10">
                <span className="font-mono text-[11px] tracking-[0.18em] text-bone-600 transition-colors duration-500 group-hover:text-track-dev">
                  {step.n}
                </span>

                <div>
                  <h3 className="font-display text-2xl leading-tight tracking-[-0.01em] sm:text-3xl">
                    {step.title}
                  </h3>
                  <p className="mt-3 max-w-xl text-[15px] leading-relaxed text-bone-400">
                    {step.body}
                  </p>
                </div>

                <span className="self-start font-mono text-[10px] uppercase leading-relaxed tracking-[0.12em] text-bone-600 sm:text-right">
                  {step.note}
                </span>
              </li>
            </Reveal>
          ))}
        </ol>
        <div className="border-t border-[var(--rule)]" />
      </div>
    </section>
  );
}
