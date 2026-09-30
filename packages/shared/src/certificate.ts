import { z } from 'zod';

/** Track slug → the code that appears inside a certificate number. */
export const TRACK_CODES: Record<string, string> = {
  development: 'DEV',
  qa: 'QA',
  'ai-engineering': 'AI',
  devops: 'OPS',
};

export const CERTIFICATE_PREFIX = 'INTX';
const SEQUENCE_DIGITS = 5;

/** Fallback code for a track added later without an entry in TRACK_CODES. */
export function trackCodeFor(slug: string): string {
  const known = TRACK_CODES[slug];
  if (known) return known;
  const derived = slug.replace(/[^a-z0-9]/gi, '').slice(0, 3).toUpperCase();
  return derived || 'GEN';
}

/**
 * Builds a certificate number: INTX-2026-DEV-00042
 *
 * The sequence is per track per year, so two tracks can both have 00001 and
 * the pair (track, year) keeps numbers short and readable.
 */
export function formatCertificateNumber(
  year: number,
  trackSlug: string,
  sequence: number,
): string {
  if (!Number.isInteger(year) || year < 2000 || year > 9999) {
    throw new RangeError(`Invalid certificate year: ${year}`);
  }
  if (!Number.isInteger(sequence) || sequence < 1) {
    throw new RangeError(`Invalid certificate sequence: ${sequence}`);
  }
  if (sequence >= 10 ** SEQUENCE_DIGITS) {
    throw new RangeError(`Certificate sequence overflowed ${SEQUENCE_DIGITS} digits`);
  }
  const code = trackCodeFor(trackSlug);
  const padded = String(sequence).padStart(SEQUENCE_DIGITS, '0');
  return `${CERTIFICATE_PREFIX}-${year}-${code}-${padded}`;
}

const CERTIFICATE_NUMBER_RE = /^INTX-\d{4}-[A-Z0-9]{2,4}-\d{5}$/;

/** Cheap shape check before a database lookup, so /verify cannot be fuzzed. */
export function isCertificateNumber(value: string): boolean {
  return CERTIFICATE_NUMBER_RE.test(value);
}

export const certificateNumberSchema = z
  .string()
  .trim()
  .transform((v) => v.toUpperCase())
  .refine(isCertificateNumber, 'That is not a valid certificate number');

/** What the public /verify page shows. Deliberately minimal — no email, no id. */
export const certificateVerificationSchema = z.object({
  certificateNumber: z.string(),
  studentName: z.string(),
  trackTitle: z.string(),
  issuedAt: z.string().datetime(),
  revoked: z.boolean(),
});

export type CertificateVerification = z.infer<typeof certificateVerificationSchema>;

export const certificateSchema = certificateVerificationSchema.extend({
  id: z.string().uuid(),
  enrollmentId: z.string().uuid(),
  pdfUrl: z.string().nullable(),
});

export type Certificate = z.infer<typeof certificateSchema>;
