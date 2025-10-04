import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Initialize Supabase client with correct environment variable names
const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl || '';
const supabaseKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey || '';

// Validate before creating client
if (!supabaseUrl || !supabaseKey || !supabaseUrl.startsWith('http')) {
  console.error('⚠️ Invalid Supabase configuration in supabase.ts:', {
    url: supabaseUrl,
    hasKey: !!supabaseKey
  });
  throw new Error(`Invalid Supabase configuration. URL: ${supabaseUrl || 'undefined'}`);
}

export const supabase = createClient(supabaseUrl, supabaseKey);
