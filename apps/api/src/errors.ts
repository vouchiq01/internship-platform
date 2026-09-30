import type { ErrorRequestHandler, RequestHandler } from 'express';

export class AppError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const notFoundHandler: RequestHandler = (_req, res) => {
  res.status(404).json({ error: { code: 'not_found', message: 'Route not found' } });
};

export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  if (err instanceof AppError) {
    res.status(err.status).json({ error: { code: err.code, message: err.message } });
    return;
  }
  // Never leak an unexpected error's message to the client.
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: { code: 'internal_error', message: 'Something went wrong' },
  });
};
