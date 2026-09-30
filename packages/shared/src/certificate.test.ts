import { describe, expect, it } from 'vitest';
import {
  formatCertificateNumber,
  isCertificateNumber,
  trackCodeFor,
  certificateNumberSchema,
} from './certificate.js';

describe('formatCertificateNumber', () => {
  it('formats a development certificate', () => {
    expect(formatCertificateNumber(2026, 'development', 42)).toBe('INTX-2026-DEV-00042');
  });

  it('pads the sequence to five digits', () => {
    expect(formatCertificateNumber(2026, 'qa', 1)).toBe('INTX-2026-QA-00001');
  });

  it('handles the largest allowed sequence', () => {
    expect(formatCertificateNumber(2026, 'devops', 99999)).toBe('INTX-2026-OPS-99999');
  });

  it('throws rather than silently truncating on overflow', () => {
    expect(() => formatCertificateNumber(2026, 'devops', 100000)).toThrow(RangeError);
  });

  it('rejects a zero or negative sequence', () => {
    expect(() => formatCertificateNumber(2026, 'qa', 0)).toThrow(RangeError);
    expect(() => formatCertificateNumber(2026, 'qa', -1)).toThrow(RangeError);
  });

  it('rejects a non-integer sequence', () => {
    expect(() => formatCertificateNumber(2026, 'qa', 1.5)).toThrow(RangeError);
  });

  it('rejects an implausible year', () => {
    expect(() => formatCertificateNumber(99, 'qa', 1)).toThrow(RangeError);
  });
});

describe('trackCodeFor', () => {
  it('maps the four known tracks', () => {
    expect(trackCodeFor('development')).toBe('DEV');
    expect(trackCodeFor('qa')).toBe('QA');
    expect(trackCodeFor('ai-engineering')).toBe('AI');
    expect(trackCodeFor('devops')).toBe('OPS');
  });

  it('derives a code for an unknown track', () => {
    expect(trackCodeFor('security')).toBe('SEC');
  });

  it('falls back to GEN when nothing usable remains', () => {
    expect(trackCodeFor('---')).toBe('GEN');
  });
});

describe('isCertificateNumber', () => {
  it('accepts a well-formed number', () => {
    expect(isCertificateNumber('INTX-2026-DEV-00042')).toBe(true);
  });

  it.each([
    'INTX-2026-DEV-42',
    'intx-2026-dev-00042',
    'INTX-26-DEV-00042',
    'XXXX-2026-DEV-00042',
    'INTX-2026-DEVELOPMENT-00042',
    "INTX-2026-DEV-00042' OR 1=1--",
    '',
  ])('rejects %j', (value) => {
    expect(isCertificateNumber(value)).toBe(false);
  });
});

describe('certificateNumberSchema', () => {
  it('upper-cases and trims before validating', () => {
    expect(certificateNumberSchema.parse('  intx-2026-dev-00042 ')).toBe('INTX-2026-DEV-00042');
  });

  it('rejects junk', () => {
    expect(() => certificateNumberSchema.parse('nonsense')).toThrow();
  });
});
