import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter } from './routes/health.js';

export function createApp(config: Config): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));
  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
