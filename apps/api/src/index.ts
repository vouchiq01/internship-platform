import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServiceClient } from './supabase.js';
import { createAuthDeps, createAuthMiddleware, requireAdmin } from './middleware/auth.js';
import { createMeDeps } from './routes/me.js';
import { createTracksDeps, rowToTrack } from './routes/tracks.js';
import { createEnrollmentsDeps } from './routes/enrollments.js';
import { createWebhookDeps } from './routes/webhooks.js';
import { createLearningDeps } from './routes/learning.js';
import { createSubmissionsDeps } from './routes/submissions.js';
import { createAdminReviewDeps } from './routes/admin-review.js';
import { createVerifyDeps } from './routes/verify.js';
import { createAdminManageDeps } from './routes/admin-manage.js';
import { createAdminInsightsDeps } from './routes/admin-insights.js';
import { createIssuanceDeps, issueCertificate } from './certificates.js';
import { createRazorpayClient } from './razorpay.js';

const config = loadConfig(process.env);
const supabase = createServiceClient(config);
const auth = createAuthMiddleware(createAuthDeps(config, supabase));
const learningDeps = createLearningDeps(supabase, auth);
const issuanceDeps = createIssuanceDeps(supabase, config.webOrigin);
const razorpay = createRazorpayClient(config);

const app = createApp(config, {
  meDeps: createMeDeps(supabase, auth),
  tracksDeps: createTracksDeps(supabase),
  enrollmentsDeps: createEnrollmentsDeps(supabase, razorpay, config.razorpayKeyId, auth),
  webhookDeps: createWebhookDeps(supabase, config.razorpayWebhookSecret),
  learningDeps,
  submissionsDeps: createSubmissionsDeps(supabase, learningDeps.getEnrollmentDetail, auth),
  adminReviewDeps: createAdminReviewDeps(supabase, auth, requireAdmin, (enrollmentId) =>
    issueCertificate(issuanceDeps, enrollmentId),
  ),
  verifyDeps: createVerifyDeps(supabase),
  adminManageDeps: createAdminManageDeps(supabase, auth, requireAdmin, rowToTrack),
  adminInsightsDeps: createAdminInsightsDeps(supabase, auth, requireAdmin),
});

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
