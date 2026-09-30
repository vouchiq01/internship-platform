import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEB_ORIGIN: z.string().url(),
  RAZORPAY_KEY_ID: z.string().min(1),
  RAZORPAY_KEY_SECRET: z.string().min(1),
  RAZORPAY_WEBHOOK_SECRET: z.string().min(1),
});

export interface Config {
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  webOrigin: string;
  razorpayKeyId: string;
  razorpayKeySecret: string;
  razorpayWebhookSecret: string;
}

export function loadConfig(env: NodeJS.ProcessEnv): Config {
  const parsed = envSchema.safeParse(env);
  if (!parsed.success) {
    const missing = parsed.error.issues
      .map((i) => `${i.path.join('.')}: ${i.message}`)
      .join('\n  ');
    throw new Error(`Invalid environment configuration:\n  ${missing}`);
  }
  return {
    port: parsed.data.PORT,
    supabaseUrl: parsed.data.SUPABASE_URL,
    supabaseServiceRoleKey: parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    webOrigin: parsed.data.WEB_ORIGIN,
    razorpayKeyId: parsed.data.RAZORPAY_KEY_ID,
    razorpayKeySecret: parsed.data.RAZORPAY_KEY_SECRET,
    razorpayWebhookSecret: parsed.data.RAZORPAY_WEBHOOK_SECRET,
  };
}
