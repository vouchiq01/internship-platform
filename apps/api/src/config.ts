import { z } from 'zod';

const envSchema = z.object({
  PORT: z.coerce.number().int().positive().default(8080),
  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  WEB_ORIGIN: z.string().url(),
});

export interface Config {
  port: number;
  supabaseUrl: string;
  supabaseServiceRoleKey: string;
  webOrigin: string;
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
  };
}
