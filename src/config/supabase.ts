import { createClient } from '@supabase/supabase-js';
import { env } from './env';

// Service-role key — full DB access, bypasses RLS. This client must NEVER be
// exposed to the dashboard or mobile app; it only lives on this server.
export const supabase = createClient(env.supabase.url, env.supabase.serviceRoleKey, {
  auth: { persistSession: false },
});