import { notFound } from 'next/navigation';
import type { EnrollmentDetail } from '@internship/shared';
import { apiFetch, ApiError } from '@/lib/api';
import { Player } from '@/components/learn/player';

export default async function LearnPage({
  params,
}: {
  params: Promise<{ enrollmentId: string }>;
}) {
  const { enrollmentId } = await params;

  let detail: EnrollmentDetail;
  try {
    detail = await apiFetch<EnrollmentDetail>(`/api/enrollments/${enrollmentId}`);
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 401)) notFound();
    throw err;
  }

  return <Player initial={detail} />;
}
