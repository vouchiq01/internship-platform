import { notFound } from 'next/navigation';
import Link from 'next/link';
import type { EnrollmentDetail, SubmissionSummary } from '@internship/shared';
import { apiFetch, classifyApiError, logApiFailure } from '@/lib/api';
import { ServiceUnavailable } from '@/components/service-unavailable';
import { accentFor } from '@/lib/track-accent';
import { SubmissionForm } from '@/components/learn/submission-form';

function StatusBanner({ latest, accent }: { latest: SubmissionSummary; accent: string }) {
  if (latest.status === 'pending') {
    return (
      <div className="border border-[var(--rule-strong)] bg-ink-800 p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
          Attempt {String(latest.attemptNumber).padStart(2, '0')} · under review
        </p>
        <h2 className="mt-4 font-display text-3xl leading-tight">A human is reading your code.</h2>
        <p className="mt-4 max-w-lg leading-relaxed text-bone-400">
          You will get either an approval or written feedback. There is nothing
          more to do right now.
        </p>
      </div>
    );
  }

  if (latest.status === 'approved') {
    return (
      <div className="border p-7" style={{ borderColor: accent }}>
        <p className="font-mono text-[10px] uppercase tracking-[0.2em]" style={{ color: accent }}>
          Approved
        </p>
        <h2 className="mt-4 font-display text-3xl leading-tight">Your project passed.</h2>
        <p className="mt-4 max-w-lg leading-relaxed text-bone-400">
          Your certificate is being issued. It will appear on your dashboard.
        </p>
      </div>
    );
  }

  return (
    <div className="border-l-2 border-track-ops bg-track-ops/10 p-7">
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-track-ops">
        Attempt {String(latest.attemptNumber).padStart(2, '0')} · changes needed
      </p>
      <h2 className="mt-4 font-display text-3xl leading-tight">Not yet — here is why.</h2>
      {latest.reviewFeedback && (
        <p className="mt-5 max-w-lg whitespace-pre-line leading-relaxed text-bone-200/90">
          {latest.reviewFeedback}
        </p>
      )}
      <p className="mt-5 font-mono text-[10px] uppercase tracking-[0.14em] text-bone-600">
        Fix it and submit again below. There is no limit on attempts.
      </p>
    </div>
  );
}

export default async function ProjectPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;

  let detail: EnrollmentDetail | null = null;
  let failure: ReturnType<typeof classifyApiError> | null = null;

  try {
    detail = await apiFetch<EnrollmentDetail>(`/api/enrollments/${enrollmentId}`);
  } catch (err) {
    failure = classifyApiError(err);
    if (failure === 'unavailable') logApiFailure(`GET /api/enrollments/${enrollmentId}`, err);
  }

  if (failure === 'not-found' || failure === 'unauthorized') notFound();

  if (!detail) {
    return (
      <ServiceUnavailable
        title="We could not load your project just now."
        body="Any submission you have already made is safe. Try again in a moment."
        backHref="/dashboard"
        backLabel="Back to your dashboard"
      />
    );
  }

  if (!detail.project) notFound();

  const accent = accentFor(detail.trackSlug);
  const latest = detail.submissions[0] ?? null;
  const canSubmit =
    detail.projectUnlocked && (!latest || latest.status === 'rejected');

  return (
    <main className="mx-auto max-w-3xl px-6 py-16">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 font-mono text-[10px] uppercase tracking-[0.2em] text-bone-600">
        <Link href={`/learn/${detail.id}`} className="transition-colors hover:text-bone-100">
          {detail.trackTitle}
        </Link>
        <span>/</span>
        <span style={{ color: accent }}>Project</span>
      </div>

      <h1 className="anim-clip mt-7 font-display text-[clamp(2.25rem,6vw,3.75rem)] leading-[1] tracking-[-0.02em]">
        {detail.project.title}
      </h1>

      <div className="mt-8 space-y-4 border-l-2 pl-6" style={{ borderColor: accent }}>
        {detail.project.briefMarkdown.split('\n\n').map((para, i) => (
          <p key={i} className="leading-relaxed text-bone-200/80">
            {para}
          </p>
        ))}
      </div>

      <div className="mt-10 border border-[var(--rule)] p-7">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-bone-400">
          To pass review, it must have
        </p>
        <ul className="mt-5 space-y-3">
          {detail.project.requirements
            .split('\n')
            .filter((l) => l.trim().startsWith('-'))
            .map((line, i) => (
              <li key={i} className="flex items-start gap-3.5 text-[15px] leading-relaxed text-bone-200/80">
                <span className="mt-2 h-1.5 w-1.5 shrink-0" style={{ background: accent }} aria-hidden />
                {line.replace(/^-\s*/, '')}
              </li>
            ))}
        </ul>
      </div>

      <section className="mt-14">
        {!detail.projectUnlocked ? (
          <div className="border border-[var(--rule)] p-7">
            <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-600">
              Locked
            </p>
            <h2 className="mt-4 font-display text-3xl leading-tight">
              Finish the lessons first.
            </h2>
            <p className="mt-4 max-w-lg leading-relaxed text-bone-400">
              The project unlocks once every module is marked complete.
            </p>
            <Link
              href={`/learn/${detail.id}`}
              className="mt-7 inline-block border-b border-[var(--rule-strong)] pb-1 font-mono text-[11px] uppercase tracking-[0.14em] text-bone-400 transition-colors hover:border-bone-100 hover:text-bone-100"
            >
              Back to lessons →
            </Link>
          </div>
        ) : (
          <>
            {latest && <StatusBanner latest={latest} accent={accent} />}

            {canSubmit && (
              <div className={latest ? 'mt-10' : ''}>
                <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone-400">
                  {latest ? `Attempt ${latest.attemptNumber + 1}` : 'Submit your project'}
                </p>
                <div className="mt-7">
                  <SubmissionForm enrollmentId={detail.id} />
                </div>
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}
