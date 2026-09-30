import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServiceClient } from './supabase.js';
import { createAuthDeps, createAuthMiddleware } from './middleware/auth.js';
import { createMeDeps } from './routes/me.js';
import { createTracksDeps } from './routes/tracks.js';
import { createEnrollmentsDeps } from './routes/enrollments.js';
import { createWebhookDeps } from './routes/webhooks.js';
import { createRazorpayClient } from './razorpay.js';

const config = loadConfig(process.env);
const supabase = createServiceClient(config);
const auth = createAuthMiddleware(createAuthDeps(config, supabase));
const razorpay = createRazorpayClient(config);

const app = createApp(config, {
  meDeps: createMeDeps(supabase, auth),
  tracksDeps: createTracksDeps(supabase),
  enrollmentsDeps: createEnrollmentsDeps(supabase, razorpay, config.razorpayKeyId, auth),
  webhookDeps: createWebhookDeps(supabase, config.razorpayWebhookSecret),
});

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
