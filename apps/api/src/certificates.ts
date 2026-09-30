import { formatCertificateNumber } from '@internship/shared';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './errors.js';
import { generateCertificatePdf } from './certificate-pdf.js';

export interface IssuanceContext {
  studentName: string;
  trackTitle: string;
  trackSlug: string;
}

export interface IssuanceDeps {
  /** Public origin of the web app, used to build the verify URL. */
  verifyBaseUrl: string;
  findExisting(
    enrollmentId: string,
  ): Promise<{ certificateNumber: string; pdfUrl: string | null } | null>;
  getIssuanceContext(enrollmentId: string): Promise<IssuanceContext | null>;
  /** Next sequence for this track and year. Must be atomic in production. */
  nextSequence(trackSlug: string, year: number): Promise<number>;
  uploadPdf(certificateNumber: string, bytes: Uint8Array): Promise<string>;
  insertCertificate(args: {
    enrollmentId: string;
    certificateNumber: string;
    studentNameSnapshot: string;
    trackTitleSnapshot: string;
    pdfUrl: string;
    issuedAt: string;
  }): Promise<void>;
  completeEnrollment(enrollmentId: string): Promise<void>;
  logAudit(action: string, entityId: string, metadata: Record<string, unknown>): Promise<void>;
}

export interface IssuanceResult {
  certificateNumber: string;
  pdfUrl: string | null;
  alreadyIssued: boolean;
}

/**
 * Issues a certificate for an approved enrollment.
 *
 * Idempotent by design: `certificates.enrollment_id` is unique, and this
 * checks for an existing row first. A retried approval returns the original
 * certificate rather than minting a second number for the same student.
 */
export async function issueCertificate(
  deps: IssuanceDeps,
  enrollmentId: string,
  now: Date = new Date(),
): Promise<IssuanceResult> {
  const existing = await deps.findExisting(enrollmentId);
  if (existing) {
    return {
      certificateNumber: existing.certificateNumber,
      pdfUrl: existing.pdfUrl,
      alreadyIssued: true,
    };
  }

  const context = await deps.getIssuanceContext(enrollmentId);
  if (!context) {
    throw new AppError(404, 'not_found', 'No enrollment to issue a certificate for');
  }

  const year = now.getUTCFullYear();
  const sequence = await deps.nextSequence(context.trackSlug, year);
  const certificateNumber = formatCertificateNumber(year, context.trackSlug, sequence);

  // Snapshotted, not joined. Renaming a track later must not rewrite the text
  // of a certificate someone has already attached to a job application.
  const studentName = context.studentName.trim() || 'Certificate Holder';
  const trackTitle = context.trackTitle.trim() || 'Internship';

  const bytes = await generateCertificatePdf({
    studentName,
    trackTitle,
    certificateNumber,
    issuedAt: now,
    verifyUrl: `${deps.verifyBaseUrl}/verify/${certificateNumber}`,
  });

  const pdfUrl = await deps.uploadPdf(certificateNumber, bytes);

  await deps.insertCertificate({
    enrollmentId,
    certificateNumber,
    studentNameSnapshot: studentName,
    trackTitleSnapshot: trackTitle,
    pdfUrl,
    issuedAt: now.toISOString(),
  });

  // Only after the certificate exists. If the insert failed, the enrollment
  // stays active so the issue can be retried.
  await deps.completeEnrollment(enrollmentId);
  await deps.logAudit('certificate.issued', enrollmentId, { certificateNumber });

  return { certificateNumber, pdfUrl, alreadyIssued: false };
}

export function createIssuanceDeps(
  supabase: SupabaseClient,
  verifyBaseUrl: string,
): IssuanceDeps {
  return {
    verifyBaseUrl,

    async findExisting(enrollmentId) {
      const { data, error } = await supabase
        .from('certificates')
        .select('certificate_number, pdf_url')
        .eq('enrollment_id', enrollmentId)
        .maybeSingle();
      if (error) throw new AppError(500, 'certificate_lookup_failed', error.message);
      if (!data) return null;
      const row = data as { certificate_number: string; pdf_url: string | null };
      return { certificateNumber: row.certificate_number, pdfUrl: row.pdf_url };
    },

    async getIssuanceContext(enrollmentId) {
      const { data, error } = await supabase
        .from('enrollments')
        .select('profiles(full_name, email), tracks(title, slug)')
        .eq('id', enrollmentId)
        .maybeSingle();
      if (error) throw new AppError(500, 'enrollment_lookup_failed', error.message);
      if (!data) return null;

      const first = <T>(v: T | T[] | null | undefined): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

      const row = data as unknown as {
        profiles: { full_name: string; email: string } | { full_name: string; email: string }[] | null;
        tracks: { title: string; slug: string } | { title: string; slug: string }[] | null;
      };
      const profile = first(row.profiles);
      const track = first(row.tracks);
      if (!track) return null;

      return {
        studentName: profile?.full_name?.trim() || profile?.email || '',
        trackTitle: track.title,
        trackSlug: track.slug,
      };
    },

    async nextSequence(trackSlug, year) {
      // Counts existing certificates for this track and year. The unique
      // constraint on certificate_number is what actually prevents a
      // collision if two approvals land at the same instant — the loser
      // fails and the approval is retried.
      const prefix = `INTX-${year}-`;
      const { data, error } = await supabase
        .from('certificates')
        .select('certificate_number, enrollments(tracks(slug))')
        .like('certificate_number', `${prefix}%`);
      if (error) throw new AppError(500, 'sequence_read_failed', error.message);

      const first = <T>(v: T | T[] | null | undefined): T | null =>
        Array.isArray(v) ? (v[0] ?? null) : (v ?? null);

      const count = ((data ?? []) as unknown as Array<{
        enrollments: { tracks: { slug: string } | { slug: string }[] | null } | null;
      }>).filter((row) => first(first(row.enrollments)?.tracks)?.slug === trackSlug).length;

      return count + 1;
    },

    async uploadPdf(certificateNumber, bytes) {
      const path = `${certificateNumber}.pdf`;
      const { error } = await supabase.storage
        .from('certificates')
        .upload(path, bytes, { contentType: 'application/pdf', upsert: true });
      if (error) throw new AppError(500, 'certificate_upload_failed', error.message);

      const { data } = supabase.storage.from('certificates').getPublicUrl(path);
      return data.publicUrl;
    },

    async insertCertificate(args) {
      const { error } = await supabase.from('certificates').insert({
        enrollment_id: args.enrollmentId,
        certificate_number: args.certificateNumber,
        student_name_snapshot: args.studentNameSnapshot,
        track_title_snapshot: args.trackTitleSnapshot,
        pdf_url: args.pdfUrl,
        issued_at: args.issuedAt,
      });
      if (error) throw new AppError(500, 'certificate_insert_failed', error.message);
    },

    async completeEnrollment(enrollmentId) {
      const { error } = await supabase
        .from('enrollments')
        .update({ status: 'completed', completed_at: new Date().toISOString() })
        .eq('id', enrollmentId);
      if (error) throw new AppError(500, 'enrollment_complete_failed', error.message);
    },

    async logAudit(action, entityId, metadata) {
      await supabase.from('audit_log').insert({
        action,
        entity_type: 'certificate',
        entity_id: entityId,
        metadata,
      });
    },
  };
}
