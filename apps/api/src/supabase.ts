import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { Config } from './config.js';

/**
 * Service-role client. Bypasses RLS entirely — this is the ONLY thing that
 * touches domain tables. Never construct this in code that runs in a browser.
 */
export function createServiceClient(config: Config): SupabaseClient {
  return createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
