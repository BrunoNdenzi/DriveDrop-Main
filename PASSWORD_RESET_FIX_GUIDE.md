# Password Reset Configuration Fix

## Problem
Password reset emails contain a mobile deep link (`drivedrop://auth/callback`) instead of the web URL, causing blank pages when users click the reset link.

## Solution

### Step 1: Update Supabase Dashboard Configuration

1. **Go to Supabase Dashboard** (https://supabase.com/dashboard)
2. Select your **DriveDrop project**
3. Navigate to **Authentication** → **URL Configuration**

4. **Update the following settings:**

   **Site URL:**
   ```
   Production: https://your-domain.com
   Development: http://localhost:3000
   ```

   **Redirect URLs** (add all of these):
   ```
   https://your-domain.com/auth/callback
   https://your-domain.com/reset-password
   https://your-domain.com/auth/reset-password
   http://localhost:3000/auth/callback
   http://localhost:3000/reset-password
   http://localhost:3000/auth/reset-password
   ```

5. **Remove or disable** any mobile deep link redirects like:
   ```
   drivedrop://auth/callback  ❌ REMOVE THIS
   ```

6. Click **Save** to apply changes

### Step 2: Test the Flow

After updating Supabase configuration:

1. **Clear browser cache and cookies**
2. Go to forgot-password page
3. Enter your email
4. Check email inbox
5. Click "Reset Password" button in email
6. Should redirect to: `https://your-domain.com/reset-password?code=...`
7. Form should appear (not blank page)
8. Enter new password
9. Should redirect to login page
10. Login with new password

### Step 3: Environment Variables

Verify your `.env.local` has the correct URLs:

```env
NEXT_PUBLIC_SUPABASE_URL=https://tngdevxxmfmhvvceipngeg.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here

# Make sure these match your Supabase dashboard settings
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

## Code Changes Made

### New Route: `/auth/reset-password/route.ts`
This route acts as a fallback handler for reset password links. It:
- Accepts both `code` and `token` parameters (Supabase uses different names)
- Redirects to `/reset-password` page with the code
- Falls back to forgot-password page if no code provided

### Updated: `/reset-password/page.tsx`
Enhanced to handle:
- Both `code` and `token` URL parameters
- Better error messages for invalid/expired links
- Async session validation
- Console logging for debugging

### Updated: `/auth/callback/route.ts`
Already configured to detect recovery type and redirect appropriately.

## Troubleshooting

### If reset link still shows blank page:

1. **Check browser console** (F12 → Console tab) for errors
2. **Check the URL** in browser address bar:
   - Should be: `your-domain.com/reset-password?code=ABC123...`
   - NOT: `about:blank` or `drivedrop://...`

3. **If URL is still `drivedrop://`:**
   - Supabase dashboard settings weren't saved correctly
   - Wait 5 minutes for DNS/cache to propagate
   - Try again with a new password reset request

4. **If page loads but shows error:**
   - Link may be expired (1 hour timeout)
   - Request a new reset link
   - Check console for specific error message

5. **For local testing:**
   - Use `http://localhost:3000` (not `127.0.0.1`)
   - Ensure dev server is running: `npm run dev`
   - Make sure Site URL in Supabase matches exactly

## Alternative: Manual URL Fix

If you can't access Supabase dashboard immediately, you can manually fix the URL:

**When you get the email:**
1. Right-click "Reset Password" button → Copy link address
2. Copy the code parameter from the URL (everything after `code=`)
3. Manually navigate to: `http://localhost:3000/reset-password?code=PASTE_CODE_HERE`
4. Complete password reset

## Production Deployment Checklist

Before deploying to production:

- [ ] Update Supabase Site URL to production domain
- [ ] Add production domain to Redirect URLs
- [ ] Remove all `localhost` and `drivedrop://` URLs from production config
- [ ] Test password reset flow on production
- [ ] Verify email links point to production domain
- [ ] Test with different email providers (Gmail, Outlook, etc.)

## Expected Email Template

Your password reset email should look like this:

```
Subject: Reset your DriveDrop password

Hi,

We received a request to reset your DriveDrop password. Click the button below to create a new password:

[Reset Password Button]

Or copy and paste this link into your browser:
https://your-domain.com/reset-password?code=ABC123...

Security Notice: This link will expire in 1 hour. If you didn't request a password reset, please ignore this email and your password will remain unchanged.

Best regards,
The DriveDrop Team
```

## Support

If issues persist after following these steps:
- Check Supabase Auth Logs (Dashboard → Authentication → Logs)
- Verify email delivery (check spam folder)
- Contact support@drivedrop.us.com with screenshots
