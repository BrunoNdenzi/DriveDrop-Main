# Loading Screen Fix Summary

## Issue Description
Users reported the app occasionally showing a blank screen or getting stuck on "signing in..." indefinitely when opening the app. This required force-closing and reopening the app.

## Root Causes Identified

### 1. **Stale Closure in Timeout**
```typescript
// BEFORE (BROKEN)
timeoutId = setTimeout(() => {
  if (mounted && loading) {  // ❌ 'loading' is stale!
    setLoading(false);
  }
}, 10000);
```

The timeout checked the `loading` state variable, but because it was captured in a closure, it always saw the **initial value** (false), not the current value. This meant the timeout **never triggered** even when the app was stuck loading.

### 2. **No Timeout on Profile Fetch**
```typescript
// BEFORE (BROKEN)
const profile = await fetchUserProfile(data.session.user.id);
// ❌ Could hang forever if network slow or database unresponsive
```

The `fetchUserProfile` function could take arbitrarily long if:
- Network was slow
- Database was unresponsive
- Supabase API had issues
- Profile creation RLS policies failed

This would leave the app loading indefinitely.

### 3. **Race Conditions in Auth State Changes**
```typescript
// BEFORE (BROKEN)
auth.onAuthStateChange(async (event, newSession) => {
  // Multiple events could fire simultaneously
  const profile = await fetchUserProfile(newSession.user.id);
  // ❌ Race condition if multiple auth events fire
});
```

If multiple auth state change events fired (e.g., SIGNED_IN, TOKEN_REFRESHED), they could trigger concurrent profile fetches that raced with each other and the initial load.

## Solutions Implemented

### 1. **Fixed Timeout to Not Use Stale State**
```typescript
// AFTER (FIXED)
timeoutId = setTimeout(() => {
  if (mounted) {  // ✅ Only check mounted flag
    console.warn('Auth loading timeout - forcing loading to false');
    setLoading(false);
  }
}, 10000);
```

Now the timeout **always fires** after 10 seconds and forces loading to false if the component is still mounted.

### 2. **Added Timeout Protection to Profile Fetches**
```typescript
// AFTER (FIXED)
try {
  const profile = await Promise.race([
    fetchUserProfile(data.session.user.id),
    new Promise<null>((_, reject) => 
      setTimeout(() => reject(new Error('Profile fetch timeout')), 8000)
    )
  ]);
  if (mounted) {
    setUserProfile(profile);
  }
} catch (profileError) {
  console.error('Error fetching profile:', profileError);
  // ✅ Continue even if profile fetch fails
  if (mounted) {
    setUserProfile(null);
  }
}
```

**Benefits:**
- Profile fetch times out after 8 seconds
- App continues loading even if profile fetch fails
- User can still use the app without profile data
- Failsafe ensures `loading` is set to false

### 3. **Prevented Race Conditions in Auth State Changes**
```typescript
// AFTER (FIXED)
let authStateLoading = false;

auth.onAuthStateChange(async (event, newSession) => {
  if (!mounted) return;
  
  // ✅ Prevent concurrent auth state changes
  if (authStateLoading) {
    console.log('Auth state change already in progress, skipping');
    return;
  }
  authStateLoading = true;
  
  try {
    // ... handle auth state change ...
  } finally {
    authStateLoading = false;
    if (mounted) {
      setLoading(false);  // ✅ Always set loading to false
    }
  }
});
```

**Benefits:**
- Only one auth state change processes at a time
- Prevents concurrent profile fetches
- Ensures `loading` is always set to false in finally block

### 4. **Graceful Degradation**
If the profile fetch fails or times out, the app:
1. Logs the error for debugging
2. Sets `userProfile` to `null`
3. Sets `loading` to `false`
4. **Allows the user to continue using the app**

This is better than hanging indefinitely - the user can access the app even if there's a temporary issue with profile loading.

## Testing Recommendations

Test the following scenarios to verify the fix:

1. **Normal startup with good network**
   - Expected: App loads normally within 2-3 seconds

2. **Startup with slow network**
   - Expected: Profile fetch times out after 8s, app still loads

3. **Startup with no network**
   - Expected: Auth timeout fires after 10s, shows login screen

4. **Startup with existing session**
   - Expected: Loads user session and profile quickly

5. **Multiple rapid auth events**
   - Expected: Race condition prevention works, no concurrent fetches

6. **Force-close during loading**
   - Expected: Cleanup runs, no memory leaks

## Files Modified

- `mobile/src/context/AuthContext.tsx` - Added timeout protection and race condition prevention

## Technical Details

### Timeout Strategy
- **Main timeout**: 10 seconds (forces loading to false)
- **Profile fetch timeout**: 8 seconds (allows 2s buffer before main timeout)
- **Rationale**: Ensures main timeout has time to clean up if profile fetch times out

### Error Handling
- All async operations wrapped in try/catch
- Profile fetch failures are logged but don't crash the app
- User can continue with `userProfile: null` state
- Errors set `loading: false` to unblock the UI

### Race Condition Prevention
- `authStateLoading` flag prevents concurrent auth state change handlers
- `mounted` flag prevents state updates after unmount
- All async operations check `mounted` before setting state

## Monitoring

After deploying this fix, monitor for:

1. **Console warnings**: "Auth loading timeout - forcing loading to false"
   - Indicates network/database issues taking >10s

2. **Profile fetch errors**: "Error fetching profile" or "Profile fetch timeout"
   - Indicates issues with profile loading that now gracefully degrade

3. **Auth state change skips**: "Auth state change already in progress, skipping"
   - Indicates multiple rapid auth events (normal on token refresh)

## Future Improvements

Consider implementing:

1. **Retry logic** for profile fetches with exponential backoff
2. **Offline-first** architecture with cached profile data
3. **Background refresh** of profile data after initial load
4. **User-facing error messages** when profile fails to load
5. **Analytics** to track how often timeouts occur in production
