import { notFound } from 'next/navigation';
import type { EnrollmentDetail } from '@internship/shared';
import { apiFetch, classifyApiError, logApiFailure } from '@/lib/api';
import { ServiceUnavailable } from '@/components/service-unavailable';
import { Player } from '@/components/learn/player';

export default async function LearnPage({
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

  // Not found and unauthorised are deliberately the same outcome: a student
  // must not be able to probe for other people's enrollment ids.
  if (failure === 'not-found' || failure === 'unauthorized') notFound();

  if (!detail) {
    return (
      <ServiceUnavailable
        title="We could not load your track just now."
        body="Your progress is safe. Something on our side is not responding — try again in a moment."
        backHref="/dashboard"
        backLabel="Back to your dashboard"
      />
    );
  }

  return <Player initial={detail} />;
}
