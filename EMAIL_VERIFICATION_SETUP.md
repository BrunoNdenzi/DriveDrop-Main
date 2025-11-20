# Configure Email Verification Redirect URL in Supabase

## Step 1: Update Supabase Dashboard Settings

Go to your **Supabase Dashboard**:

1. Navigate to: **Authentication → URL Configuration**
2. Find **"Site URL"** - Set to: `https://drivedrop.vercel.app`
3. Find **"Redirect URLs"** - Add these URLs:
   ```
   https://drivedrop.vercel.app/auth/callback
   https://drivedrop.vercel.app/auth/confirm
   http://localhost:3000/auth/callback
   http://localhost:3000/auth/confirm
   drivedrop://auth/callback
   ```
4. Click **Save**

## Step 2: Update Mobile App to Use Website Redirect (Optional)

If you want email verification to open the website instead of the app, update the signup code:

```typescript
options: {
  data: {
    first_name: firstName,
    last_name: lastName,
    role: role
  },
  emailRedirectTo: 'https://drivedrop.vercel.app/auth/callback'  // Changed from drivedrop://
}
```

## Step 3: Verify Email Template

The verification email will now redirect to your website after clicking the link.

**Current Flow:**
1. User signs up
2. Gets verification email
3. Clicks link → Goes to `https://drivedrop.vercel.app/auth/callback`
4. Website confirms email
5. User can login

## Note:
- Mobile deep link `drivedrop://` is for in-app email verification
- Website URL is for web browser verification
- Both can coexist - Supabase will use the `emailRedirectTo` parameter
