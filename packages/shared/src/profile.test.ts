import { describe, expect, it } from 'vitest';
import { profileSchema, updateProfileSchema } from './profile.js';

describe('profileSchema', () => {
  const valid = {
    id: '3f6b7a1e-9c0d-4e2f-8a1b-2c3d4e5f6a7b',
    email: 'student@example.com',
    fullName: 'Asha Kumar',
    phone: null,
    college: null,
    graduationYear: null,
    role: 'student',
    createdAt: '2026-09-30T10:00:00.000Z',
  };

  it('accepts a valid profile', () => {
    expect(profileSchema.parse(valid)).toEqual(valid);
  });

  it('rejects a non-uuid id', () => {
    expect(() => profileSchema.parse({ ...valid, id: 'nope' })).toThrow();
  });

  it('rejects an unknown role', () => {
    expect(() => profileSchema.parse({ ...valid, role: 'superadmin' })).toThrow();
  });
});

describe('updateProfileSchema', () => {
  it('accepts a partial update', () => {
    expect(updateProfileSchema.parse({ college: 'NIT Trichy' }))
      .toEqual({ college: 'NIT Trichy' });
  });

  it('rejects a graduation year outside a sane range', () => {
    expect(() => updateProfileSchema.parse({ graduationYear: 1899 })).toThrow();
  });

  it('does not allow role to be self-assigned', () => {
    const parsed = updateProfileSchema.parse({ role: 'admin' } as never);
    expect(parsed).not.toHaveProperty('role');
  });
});
