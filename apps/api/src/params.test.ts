import { describe, expect, it } from 'vitest';
import type { Request } from 'express';
import { requireParam } from './params.js';
import { AppError } from './errors.js';

const req = (params: Record<string, unknown>) => ({ params }) as unknown as Request;

describe('requireParam', () => {
  it('returns a plain string parameter', () => {
    expect(requireParam(req({ id: 'abc' }), 'id')).toBe('abc');
  });

  it('takes the first value when the parameter repeats', () => {
    expect(requireParam(req({ id: ['first', 'second'] }), 'id')).toBe('first');
  });

  it('throws a 400 when the parameter is missing', () => {
    expect(() => requireParam(req({}), 'id')).toThrow(AppError);
    try {
      requireParam(req({}), 'id');
    } catch (err) {
      expect((err as AppError).status).toBe(400);
    }
  });

  it('throws a 400 on an empty string', () => {
    expect(() => requireParam(req({ id: '' }), 'id')).toThrow(AppError);
  });

  it('throws a 400 on an empty array', () => {
    expect(() => requireParam(req({ id: [] }), 'id')).toThrow(AppError);
  });
});
