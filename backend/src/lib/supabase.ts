// supabase.ts
// Cast to any to allow generic usage with local Database type when upstream types missing
// (shim declared in types/shims.d.ts)
import { createClient as rawCreateClient } from '@supabase/supabase-js';
const createClient: any = rawCreateClient as any;
import config from '@config/index';

if (!config.supabase.url || !config.supabase.anonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for general API operations (uses anon key)
export const supabase = createClient(
  config.supabase.url,
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle JWT manually
    },
  }
) as any; // Keep broad any so existing calls (from, rpc, auth) type-check

// Admin client for service operations (uses service role key)
export const supabaseAdmin = createClient(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
) as any;

/**
 * Create a Supabase client with a specific user's JWT token
 */
export const createUserSupabaseClient = (accessToken: string) => {
  return createClient(
    config.supabase.url,
    config.supabase.anonKey,
    {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  ) as any;
};
