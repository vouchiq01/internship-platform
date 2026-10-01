import { describe, expect, it } from 'vitest';
import { ApiError, classifyApiError } from './api';

describe('classifyApiError', () => {
  it('treats 404 as not found', () => {
    expect(classifyApiError(new ApiError(404, 'not_found', 'nope'))).toBe('not-found');
  });

  it('treats 401 and 403 as unauthorized', () => {
    expect(classifyApiError(new ApiError(401, 'unauthenticated', 'nope'))).toBe('unauthorized');
    expect(classifyApiError(new ApiError(403, 'forbidden', 'nope'))).toBe('unauthorized');
  });

  it('treats a 500 as unavailable, NOT as not found', () => {
    // The distinction that matters: a backend outage must never tell a
    // visitor that the thing they asked for does not exist.
    expect(classifyApiError(new ApiError(500, 'internal_error', 'boom'))).toBe('unavailable');
  });

  it('treats a 502 and 503 as unavailable', () => {
    expect(classifyApiError(new ApiError(502, 'bad_gateway', 'boom'))).toBe('unavailable');
    expect(classifyApiError(new ApiError(503, 'unavailable', 'boom'))).toBe('unavailable');
  });

  it('treats a network failure as unavailable', () => {
    expect(classifyApiError(new TypeError('fetch failed'))).toBe('unavailable');
  });

  it('treats a thrown string as unavailable', () => {
    expect(classifyApiError('something odd')).toBe('unavailable');
  });

  it('treats null and undefined as unavailable', () => {
    expect(classifyApiError(null)).toBe('unavailable');
    expect(classifyApiError(undefined)).toBe('unavailable');
  });

  it('treats an unrecognised 4xx as unavailable rather than guessing', () => {
    expect(classifyApiError(new ApiError(418, 'teapot', 'nope'))).toBe('unavailable');
  });
});
