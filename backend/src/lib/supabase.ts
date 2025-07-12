// supabase.ts
import { createClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import config from '@config/index';

if (!config.supabase.url || !config.supabase.anonKey) {
  throw new Error('Missing Supabase environment variables');
}

// Client for general API operations (uses anon key)
export const supabase = createClient<Database>(
  config.supabase.url, 
  config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: true,
      persistSession: false, // We handle JWT manually
    },
  }
);

// Admin client for service operations (uses service role key)
export const supabaseAdmin = createClient<Database>(
  config.supabase.url,
  config.supabase.serviceRoleKey || config.supabase.anonKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Create a Supabase client with a specific user's JWT token
 */
export const createUserSupabaseClient = (accessToken: string) => {
  return createClient<Database>(
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
  );
};
