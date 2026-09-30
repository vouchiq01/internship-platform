import { describe, expect, it, vi } from 'vitest';
import { issueCertificate, type IssuanceDeps } from './certificates.js';

const ENR = '88888888-8888-4888-8888-888888888888';

function deps(over: Partial<IssuanceDeps> = {}) {
  const uploadPdf = vi.fn(async () => 'https://storage.test/cert.pdf');
  const insertCertificate = vi.fn(async () => {});
  const completeEnrollment = vi.fn(async () => {});
  const logAudit = vi.fn(async () => {});

  const d: IssuanceDeps = {
    verifyBaseUrl: 'https://example.test',
    findExisting: async () => null,
    getIssuanceContext: async () => ({
      studentName: 'Asha Kumar',
      trackTitle: 'Development',
      trackSlug: 'development',
    }),
    nextSequence: async () => 42,
    uploadPdf,
    insertCertificate,
    completeEnrollment,
    logAudit,
    ...over,
  };
  return { d, uploadPdf, insertCertificate, completeEnrollment, logAudit };
}

describe('issueCertificate', () => {
  it('issues a numbered certificate and completes the enrollment', async () => {
    const { d, uploadPdf, insertCertificate, completeEnrollment } = deps();
    const result = await issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z'));

    expect(result.certificateNumber).toBe('INTX-2026-DEV-00042');
    expect(uploadPdf).toHaveBeenCalledTimes(1);
    expect(insertCertificate).toHaveBeenCalledWith(
      expect.objectContaining({
        enrollmentId: ENR,
        certificateNumber: 'INTX-2026-DEV-00042',
        studentNameSnapshot: 'Asha Kumar',
        trackTitleSnapshot: 'Development',
      }),
    );
    expect(completeEnrollment).toHaveBeenCalledWith(ENR);
  });

  it('snapshots the name and track rather than referencing them', async () => {
    const { d, insertCertificate } = deps();
    await issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z'));
    const args = insertCertificate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.studentNameSnapshot).toBe('Asha Kumar');
    expect(args.trackTitleSnapshot).toBe('Development');
  });

  it('is idempotent — an already-issued certificate is returned, not reissued', async () => {
    const { d, uploadPdf, insertCertificate } = deps({
      findExisting: async () => ({
        certificateNumber: 'INTX-2026-DEV-00007',
        pdfUrl: 'https://storage.test/old.pdf',
      }),
    });

    const result = await issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z'));

    expect(result.certificateNumber).toBe('INTX-2026-DEV-00007');
    expect(result.alreadyIssued).toBe(true);
    expect(uploadPdf).not.toHaveBeenCalled();
    expect(insertCertificate).not.toHaveBeenCalled();
  });

  it('uses the year of issuance in the number', async () => {
    const { d } = deps();
    const result = await issueCertificate(d, ENR, new Date('2027-01-05T00:00:00Z'));
    expect(result.certificateNumber).toBe('INTX-2027-DEV-00042');
  });

  it('embeds the public verify URL in the PDF arguments', async () => {
    const { d, uploadPdf } = deps();
    await issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z'));
    const [, bytes] = uploadPdf.mock.calls[0] as unknown as [string, Uint8Array];
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('throws when the enrollment has no issuance context', async () => {
    const { d, insertCertificate } = deps({ getIssuanceContext: async () => null });
    await expect(
      issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z')),
    ).rejects.toThrow();
    expect(insertCertificate).not.toHaveBeenCalled();
  });

  it('does not complete the enrollment if the row insert fails', async () => {
    const { d, completeEnrollment } = deps({
      insertCertificate: async () => {
        throw new Error('unique violation');
      },
    });
    await expect(
      issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z')),
    ).rejects.toThrow();
    expect(completeEnrollment).not.toHaveBeenCalled();
  });

  it('falls back to the email when the student has no name', async () => {
    const { d, insertCertificate } = deps({
      getIssuanceContext: async () => ({
        studentName: '',
        trackTitle: 'QA',
        trackSlug: 'qa',
      }),
    });
    await issueCertificate(d, ENR, new Date('2026-09-30T00:00:00Z'));
    const args = insertCertificate.mock.calls[0]?.[0] as Record<string, unknown>;
    expect(args.studentNameSnapshot).toBe('Certificate Holder');
  });
});
