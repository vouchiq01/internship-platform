import type { Request } from 'express';
import { AppError } from './errors.js';

/**
 * Reads a required route parameter as a string.
 *
 * Express 5 types `req.params[x]` as `string | string[] | undefined` because a
 * repeated parameter can arrive as an array. Rather than casting past that,
 * this narrows it and turns the impossible cases into a clean 400 instead of
 * a runtime surprise deeper in a query.
 */
export function requireParam(req: Request, name: string): string {
  const raw = (req.params as Record<string, string | string[] | undefined>)[name];
  const value = Array.isArray(raw) ? raw[0] : raw;
  if (typeof value !== 'string' || value.length === 0) {
    throw new AppError(400, 'invalid_param', `Missing route parameter: ${name}`);
  }
  return value;
}
