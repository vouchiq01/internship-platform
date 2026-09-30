import express from 'express';
import cors from 'cors';
import type { Config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { healthRouter } from './routes/health.js';
import { createMeRouter, type MeDeps } from './routes/me.js';
import { createTracksRouter, type TracksDeps } from './routes/tracks.js';
import { createEnrollmentsRouter, type EnrollmentsDeps } from './routes/enrollments.js';
import { createWebhookRouter, type WebhookDeps } from './routes/webhooks.js';
import { createLearningRouter, type LearningDeps } from './routes/learning.js';

export interface AppOverrides {
  meDeps?: MeDeps;
  tracksDeps?: TracksDeps;
  enrollmentsDeps?: EnrollmentsDeps;
  webhookDeps?: WebhookDeps;
  learningDeps?: LearningDeps;
}

export function createApp(config: Config, overrides: AppOverrides = {}): express.Express {
  const app = express();

  app.use(cors({ origin: config.webOrigin, credentials: true }));

  // The webhook is mounted FIRST, with a raw body parser. Razorpay signs the
  // exact bytes it sent, so express.json() must not consume and re-serialise
  // the body before we verify it. Order here is load-bearing.
  if (overrides.webhookDeps) {
    app.use(
      '/api',
      express.raw({ type: 'application/json' }),
      createWebhookRouter(overrides.webhookDeps),
    );
  }

  app.use(express.json({ limit: '1mb' }));

  app.use(healthRouter);
  if (overrides.tracksDeps) app.use('/api', createTracksRouter(overrides.tracksDeps));
  if (overrides.meDeps) app.use('/api', createMeRouter(overrides.meDeps));
  if (overrides.enrollmentsDeps) {
    app.use('/api', createEnrollmentsRouter(overrides.enrollmentsDeps));
  }
  if (overrides.learningDeps) app.use('/api', createLearningRouter(overrides.learningDeps));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
