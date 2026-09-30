import { Router, type RequestHandler } from 'express';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  updateProfileSchema,
  type Profile,
  type UpdateProfileInput,
} from '@internship/shared';
import { AppError } from '../errors.js';

export interface MeDeps {
  auth: RequestHandler;
  getProfile(id: string): Promise<Profile | null>;
  updateProfile(id: string, input: UpdateProfileInput): Promise<Profile>;
}

interface ProfileRow {
  id: string;
  email: string;
  full_name: string;
  phone: string | null;
  college: string | null;
  graduation_year: number | null;
  role: Profile['role'];
  created_at: string;
}

/** The single place snake_case DB columns become camelCase API fields. */
export function rowToProfile(row: ProfileRow): Profile {
  return {
    id: row.id,
    email: row.email,
    fullName: row.full_name,
    phone: row.phone,
    college: row.college,
    graduationYear: row.graduation_year,
    role: row.role,
    createdAt: row.created_at,
  };
}

export function createMeDeps(supabase: SupabaseClient, auth: RequestHandler): MeDeps {
  return {
    auth,
    async getProfile(id) {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', id)
        .maybeSingle();
      if (error) throw new AppError(500, 'profile_lookup_failed', error.message);
      return data ? rowToProfile(data as ProfileRow) : null;
    },
    async updateProfile(id, input) {
      const patch: Record<string, unknown> = {};
      if (input.fullName !== undefined) patch.full_name = input.fullName;
      if (input.phone !== undefined) patch.phone = input.phone;
      if (input.college !== undefined) patch.college = input.college;
      if (input.graduationYear !== undefined) patch.graduation_year = input.graduationYear;

      const { data, error } = await supabase
        .from('profiles')
        .update(patch)
        .eq('id', id)
        .select('*')
        .single();
      if (error) throw new AppError(500, 'profile_update_failed', error.message);
      return rowToProfile(data as ProfileRow);
    },
  };
}

export function createMeRouter(deps: MeDeps): Router {
  const router = Router();

  router.get('/me', deps.auth, async (req, res, next) => {
    try {
      const profile = await deps.getProfile(req.auth!.id);
      if (!profile) throw new AppError(404, 'not_found', 'Profile not found');
      res.json(profile);
    } catch (err) {
      next(err);
    }
  });

  router.patch('/me', deps.auth, async (req, res, next) => {
    try {
      const parsed = updateProfileSchema.safeParse(req.body);
      if (!parsed.success) {
        throw new AppError(
          400,
          'validation_failed',
          parsed.error.issues[0]?.message ?? 'Invalid body',
        );
      }
      // parsed.data has already had unknown keys (including `role`) stripped.
      const updated = await deps.updateProfile(req.auth!.id, parsed.data);
      res.json(updated);
    } catch (err) {
      next(err);
    }
  });

  return router;
}
