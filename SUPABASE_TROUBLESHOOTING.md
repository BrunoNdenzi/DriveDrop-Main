# Fixing Supabase User Creation and RLS Policy Issues

## Problem: "Database error creating user in Supabase"

When encountering the error "Database error creating user in Supabase" during user registration, the issue is typically related to one of the following:

1. Row Level Security (RLS) policies on the `profiles` table are incorrect
2. The `profiles` table structure doesn't match what's expected in the application
3. The user creation process is attempting to insert into `profiles` with incorrect parameters

## Solution

### 1. Check and Fix RLS Policies

The most common issue is that the RLS policies on the `profiles` table are using incorrect column references or conditions. Here's how to fix them:

```sql
-- Drop existing policies
DROP POLICY IF EXISTS "Allow individual read access" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual update access" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual delete access" ON public.profiles;
DROP POLICY IF EXISTS "Allow individual insert access" ON public.profiles;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;
DROP POLICY IF EXISTS "Enable update for users based on id" ON public.profiles;

-- Enable RLS on profiles table
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create proper policies that use auth.uid() for matching the id field
-- Policy for INSERT: Only allow authenticated users to insert their own profile
CREATE POLICY "Enable insert for authenticated users only" ON public.profiles
    FOR INSERT
    TO authenticated
    WITH CHECK (id = auth.uid());

-- Policy for SELECT: Allow users to read only their own profile
CREATE POLICY "Enable read access for authenticated users" ON public.profiles
    FOR SELECT
    TO authenticated
    USING (id = auth.uid());

-- Policy for UPDATE: Allow users to update only their own profile
CREATE POLICY "Enable update for users based on id" ON public.profiles
    FOR UPDATE
    TO authenticated
    USING (id = auth.uid())
    WITH CHECK (id = auth.uid());
```

### 2. Verify Profiles Table Structure

Ensure the `profiles` table has the correct structure:

```sql
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    first_name TEXT,
    last_name TEXT,
    email TEXT,
    avatar_url TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

The critical part is that the `id` column should be a UUID that references `auth.users(id)` and has the proper cascade deletion.

### 3. Applying Fixes with Supabase CLI

To apply these fixes using the Supabase CLI:

1. Create a SQL file with the fixes (e.g., `fix_profiles_policy.sql`)
2. Run the file using the Supabase CLI:

```bash
# Navigate to your project directory
cd your-project-directory

# Link to your Supabase project if not already linked
npx supabase link --project-ref your-project-ref

# Run the SQL file
npx supabase functions invoke -b "sql: $(cat fix_profiles_policy.sql)"
```

### 4. Fixing in the Supabase Dashboard

If you can't use the CLI, you can apply these fixes in the Supabase Dashboard:

1. Go to the SQL Editor
2. Paste the SQL commands from the fix_profiles_policy.sql file
3. Run the SQL

### 5. Check Client-Side Code

Ensure your client-side code is properly creating users:

```typescript
// Good: Correct approach using options.data for user metadata
const { data, error } = await supabase.auth.signUp({
  email: 'example@email.com',
  password: 'example-password',
  options: {
    data: {
      first_name: 'John',
      last_name: 'Doe'
    }
  }
});

// After auth.signUp succeeds, profiles table insertion should happen automatically
// through Supabase triggers, or you can manually insert like this:
if (data?.user) {
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id: data.user.id, // Must match auth.uid()
      first_name: 'John',
      last_name: 'Doe',
      email: 'example@email.com'
    });
}
```

## Troubleshooting

If you continue to have issues:

1. Check Supabase logs in the Dashboard (Database > Logs)
2. Verify that email confirmations are properly configured
3. Make sure there are no triggers that might be interfering with user creation
4. Ensure there are no unique constraints being violated (e.g., duplicate emails)
5. Check for any foreign key constraints that might be failing

## Using Supabase CLI

Always use the Supabase CLI via `npx` to ensure you're using the latest version:

```bash
# General syntax
npx supabase <command>

# Examples
npx supabase link --project-ref your-project-ref
npx supabase db dump --schema=public
npx supabase functions invoke -b "sql: $(cat your-sql-file.sql)"
```

This approach ensures you don't need a global installation and always use the latest version.
