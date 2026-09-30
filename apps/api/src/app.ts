import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter } from './routes/health.js';
import { createMeRouter, type MeDeps } from './routes/me.js';

export interface AppOverrides {
  meDeps?: MeDeps;
}

export function createApp(config: Config, overrides: AppOverrides = {}): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  if (overrides.meDeps) {
    app.use('/api', createMeRouter(overrides.meDeps));
  }

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
