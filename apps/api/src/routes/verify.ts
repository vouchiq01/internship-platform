import { Router } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import { isCertificateNumber, type CertificateVerification } from '@internship/shared';
import { AppError } from '../errors.js';
import { requireParam } from '../params.js';

export interface VerifyDeps {
  lookup(certificateNumber: string): Promise<CertificateVerification | null>;
}

export function createVerifyDeps(supabase: SupabaseClient): VerifyDeps {
  return {
    async lookup(certificateNumber) {
      const { data, error } = await supabase
        .from('certificates')
        .select('certificate_number, student_name_snapshot, track_title_snapshot, issued_at, revoked_at')
        .eq('certificate_number', certificateNumber)
        .maybeSingle();
      if (error) throw new AppError(500, 'verify_lookup_failed', error.message);
      if (!data) return null;

      const row = data as {
        certificate_number: string;
        student_name_snapshot: string;
        track_title_snapshot: string;
        issued_at: string;
        revoked_at: string | null;
      };

      return {
        certificateNumber: row.certificate_number,
        studentName: row.student_name_snapshot,
        trackTitle: row.track_title_snapshot,
        issuedAt: row.issued_at,
        revoked: row.revoked_at !== null,
      };
    },
  };
}

export function createVerifyRouter(deps: VerifyDeps): Router {
  const router = Router();

  // Public. No authentication — a recruiter must be able to check a
  // certificate without an account, which is the point of the product.
  router.get('/verify/:number', async (req, res, next) => {
    try {
      const raw = requireParam(req, 'number').trim().toUpperCase();

      // Shape-check before touching the database so the endpoint cannot be
      // used to enumerate or probe with arbitrary strings.
      if (!isCertificateNumber(raw)) {
        throw new AppError(400, 'invalid_certificate_number', 'That is not a certificate number');
      }

      const certificate = await deps.lookup(raw);
      if (!certificate) {
        throw new AppError(404, 'not_found', 'No certificate with that number');
      }

      // A revoked certificate is returned as revoked, not hidden. A recruiter
      // seeing "revoked" learns the truth; a 404 would be ambiguous.
      res.json(certificate);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
