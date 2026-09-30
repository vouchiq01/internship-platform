import { z } from 'zod';
import { userRoleSchema } from './enums.js';

export const profileSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  fullName: z.string(),
  phone: z.string().nullable(),
  college: z.string().nullable(),
  graduationYear: z.number().int().nullable(),
  role: userRoleSchema,
  createdAt: z.string().datetime(),
});

export type Profile = z.infer<typeof profileSchema>;

/**
 * Fields a student may change about themselves.
 * `role` is deliberately absent — it is set by an admin, never by the user.
 * `.strict()` is NOT used: unknown keys are stripped rather than rejected,
 * so a client sending `role` gets it silently dropped instead of a 400.
 */
export const updateProfileSchema = z.object({
  fullName: z.string().min(1).max(120).optional(),
  phone: z.string().min(7).max(20).nullable().optional(),
  college: z.string().min(1).max(200).nullable().optional(),
  graduationYear: z.number().int().min(1950).max(2100).nullable().optional(),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
