// Temporary shims for missing external type declarations
declare module '@supabase/supabase-js' {
  export function createClient(url: string, key: string, options?: any): any;
}

declare module 'tsconfig-paths';
// Shims for libraries without type declarations in this project
declare module 'tsconfig-paths';
declare module '@supabase/supabase-js';
