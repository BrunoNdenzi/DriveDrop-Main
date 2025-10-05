// supabase.ts
import 'react-native-url-polyfill/auto';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from './database.types';
import * as SecureStore from 'expo-secure-store';
import Constants from 'expo-constants';

// SecureStore adapter for Supabase storage
const ExpoSecureStoreAdapter = {
  getItem: (key: string) => {
    return SecureStore.getItemAsync(key);
  },
  setItem: (key: string, value: string) => {
    return SecureStore.setItemAsync(key, value);
  },
  removeItem: (key: string) => {
    return SecureStore.deleteItemAsync(key);
  },
};

// Lazy initialization - DON'T create client at module load time!
let supabaseInstance: SupabaseClient<Database> | null = null;

function getSupabaseConfig() {
  try {
    const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || Constants.expoConfig?.extra?.supabaseUrl as string;
    const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || Constants.expoConfig?.extra?.supabaseAnonKey as string;
    
    // Return config without throwing - let the caller handle it
    return { supabaseUrl, supabaseAnonKey };
  } catch (error) {
    console.error('Failed to get Supabase config:', error);
    return { supabaseUrl: null, supabaseAnonKey: null };
  }
}

// Lazy getter - only creates client when accessed
export function getSupabase(): SupabaseClient<Database> {
  if (supabaseInstance) {
    return supabaseInstance;
  }
  
  const { supabaseUrl, supabaseAnonKey } = getSupabaseConfig();
  
  // Validate but DON'T throw - return a dummy client instead
  if (!supabaseUrl || !supabaseAnonKey || !supabaseUrl.startsWith('http')) {
    console.error('⚠️ Invalid Supabase configuration - using placeholder');
    // Return a placeholder that won't crash
    supabaseInstance = createClient('https://placeholder.supabase.co', 'placeholder-key', {
      auth: {
        storage: ExpoSecureStoreAdapter,
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    });
    return supabaseInstance;
  }

  console.log('✅ Supabase client initializing');
  
  // Create real Supabase client
  supabaseInstance = createClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      storage: ExpoSecureStoreAdapter,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  });
  
  return supabaseInstance;
}

// Export as named export for backward compatibility
export const supabase = new Proxy({} as SupabaseClient<Database>, {
  get(target, prop) {
    const client = getSupabase();
    return (client as any)[prop];
  }
});

// Export auth helpers with lazy Proxy (do NOT access supabase.auth at module load!)
export const auth = new Proxy({} as ReturnType<SupabaseClient<Database>['auth']['getUser']>, {
  get(target, prop) {
    const client = getSupabase();
    return (client.auth as any)[prop];
  }
});
