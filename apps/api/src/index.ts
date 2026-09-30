import { createApp } from './app.js';
import { loadConfig } from './config.js';
import { createServiceClient } from './supabase.js';
import { createAuthDeps, createAuthMiddleware } from './middleware/auth.js';
import { createMeDeps } from './routes/me.js';

const config = loadConfig(process.env);
const supabase = createServiceClient(config);
const auth = createAuthMiddleware(createAuthDeps(config, supabase));

const app = createApp(config, { meDeps: createMeDeps(supabase, auth) });

app.listen(config.port, () => {
  console.log(`API listening on :${config.port}`);
});
