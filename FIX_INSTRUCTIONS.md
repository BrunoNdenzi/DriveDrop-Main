# Fixing DriveDrop User Creation with Supabase

This guide explains how to execute the SQL script to fix the "Database error creating user in Supabase" issue.

## Prerequisites

1. Make sure you have [Node.js](https://nodejs.org/) installed
2. You need proper access to the Supabase project

## Instructions for Fixing the Issue

### Step 1: Log in to Supabase

First, make sure you're logged in to Supabase CLI:

```bash
npx supabase login
```

### Step 2: Link to Your Project

Link your local environment to your Supabase project:

```bash
# List all available projects
npx supabase projects list

# Link to your specific project (replace with your project ref)
npx supabase link --project-ref YOUR_PROJECT_REF
```

### Step 3: Run the SQL Fix

Execute the SQL file to fix the profiles table and its policies:

```bash
# On Linux/macOS
npx supabase functions invoke -b "sql: $(cat fix_profiles_policy.sql)"

# On Windows PowerShell
$sqlContent = Get-Content -Raw fix_profiles_policy.sql
npx supabase functions invoke -b "sql: $sqlContent"
```

If the above method doesn't work, you can also execute the SQL directly in the Supabase Dashboard:

1. Go to your Supabase project dashboard
2. Click on "SQL Editor"
3. Create a new query
4. Copy the contents of `fix_profiles_policy.sql` into the editor
5. Click "Run" to execute the query

### Step 4: Verify the Fix

1. Try creating a new user through the app
2. Check the profiles table in the Supabase Dashboard to confirm the user was created successfully
3. Verify that you can log in with the new user

## What the Fix Does

The SQL script:

1. Drops any incorrect existing policies on the profiles table
2. Enables Row Level Security on the profiles table
3. Creates proper insert, select, and update policies that use `auth.uid()` to match the user's ID
4. Ensures the profiles table has the correct structure with the required columns

## Troubleshooting

If you encounter issues:

1. Check the Supabase logs in the Dashboard (Database > Logs)
2. Verify that email confirmations are properly configured in the Authentication settings
3. Make sure there are no triggers that might be interfering with user creation

For more detailed troubleshooting, see the [SUPABASE_TROUBLESHOOTING.md](SUPABASE_TROUBLESHOOTING.md) document.
