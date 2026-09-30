import { describe, expect, it } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { generateCertificatePdf } from './certificate-pdf.js';

const args = {
  studentName: 'Asha Kumar',
  trackTitle: 'Development',
  certificateNumber: 'INTX-2026-DEV-00042',
  issuedAt: new Date('2026-09-30T10:00:00.000Z'),
  verifyUrl: 'https://example.test/verify/INTX-2026-DEV-00042',
};

describe('generateCertificatePdf', () => {
  it('produces bytes with a PDF header', async () => {
    const bytes = await generateCertificatePdf(args);
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('produces a single landscape A4 page', async () => {
    const doc = await PDFDocument.load(await generateCertificatePdf(args));
    expect(doc.getPageCount()).toBe(1);
    const { width, height } = doc.getPage(0).getSize();
    expect(Math.round(width)).toBe(842);
    expect(Math.round(height)).toBe(595);
    expect(width).toBeGreaterThan(height);
  });

  it('sets document metadata from the certificate', async () => {
    const doc = await PDFDocument.load(await generateCertificatePdf(args));
    expect(doc.getTitle()).toContain('INTX-2026-DEV-00042');
    expect(doc.getSubject()).toContain('Development');
  });

  it('handles a long name without throwing', async () => {
    const bytes = await generateCertificatePdf({
      ...args,
      studentName: 'Venkata Satyanarayana Subrahmanyam Chandrasekhar Rao',
    });
    expect(bytes.byteLength).toBeGreaterThan(500);
  });

  it('strips characters the standard font cannot encode rather than crashing', async () => {
    // WinAnsi cannot encode Devanagari. A student typing their name in Hindi
    // must still get a certificate, not a 500.
    const bytes = await generateCertificatePdf({ ...args, studentName: 'आशा कुमार' });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });

  it('never produces an empty name line', async () => {
    const bytes = await generateCertificatePdf({ ...args, studentName: '   ' });
    expect(Buffer.from(bytes.slice(0, 5)).toString()).toBe('%PDF-');
  });
});
