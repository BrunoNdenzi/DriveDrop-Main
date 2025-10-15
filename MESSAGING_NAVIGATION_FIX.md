# Messaging Navigation & Display Fix

## Issues Fixed ✅

### Issue 1: Navigation Error
**Problem**: App crashed when tapping conversations with error:
```
ERROR  The action 'NAVIGATE' with payload {"name":"Chat",...} was not handled by any navigator.
Do you have a screen named 'Chat'?
```

**Root Cause**: Navigation stack has screen registered as `'ChatScreen'` but code was navigating to `'Chat'`

**Fix**: Updated `ConversationsScreen.tsx` line 107 to navigate to correct screen name
```typescript
// Before:
(navigation.navigate as any)('Chat', {...});

// After:
(navigation.navigate as any)('ChatScreen', {...});
```

### Issue 2: "Unknown User" Display
**Problem**: All conversations showed "Unknown User" instead of actual names

**Root Cause**: SQL view was concatenating `first_name` and `last_name` without handling NULL values. When either field was NULL, the entire expression returned NULL.

**Fix**: Updated `conversation_summaries` view with COALESCE fallback:
```sql
-- Before:
c.first_name || ' ' || c.last_name AS client_name

-- After:
COALESCE(c.first_name || ' ' || c.last_name, c.email, 'Unknown User') AS client_name
```

This provides a 3-level fallback:
1. Try full name (first + last)
2. If NULL, use email
3. If email NULL, show "Unknown User"

## Files Modified

### 1. `mobile/src/screens/ConversationsScreen.tsx`
- Line 107: Changed navigation target from `'Chat'` → `'ChatScreen'`

### 2. `sql/MESSAGING_SYSTEM_FRESH_START.sql`
- Lines 282-283: Added COALESCE for client_name
- Lines 284-285: Added COALESCE for driver_name

### 3. New File: `sql/UPDATE_CONVERSATION_VIEW.sql`
- Quick patch script to update just the view without re-running full migration

## How to Apply the Fix

### Option A: If you haven't run the SQL migration yet
Run the updated file:
```
sql/MESSAGING_SYSTEM_FRESH_START.sql
```
Then restart your app with `npx expo start --clear`

### Option B: If you already ran the SQL migration
Run this quick patch in Supabase SQL Editor:
```
sql/UPDATE_CONVERSATION_VIEW.sql
```
Then restart your app with `npx expo start --clear`

## Testing Checklist

After applying the fix, verify:

- [ ] App builds successfully without errors
- [ ] Conversations screen loads without crashing
- [ ] User names display correctly (not "Unknown User")
- [ ] Tapping a conversation navigates to chat screen
- [ ] No navigation errors in console
- [ ] Messages send and receive properly
- [ ] Read receipts work correctly

## Why This Happened

1. **Navigation mismatch**: During rapid iteration, the screen name in navigation config (`ChatScreen`) got out of sync with the navigation call (`Chat`)

2. **NULL name handling**: PostgreSQL string concatenation returns NULL if any operand is NULL. Some user profiles had incomplete names (e.g., only first_name filled, last_name NULL), causing the entire concatenation to fail.

## Prevention

To prevent similar issues:

1. **Navigation**: Use TypeScript properly typed navigation params (see React Navigation docs)
2. **SQL NULLs**: Always use COALESCE when concatenating strings that might be NULL
3. **Data validation**: Ensure profiles table requires both first_name and last_name on insert

## Related Files

- Navigation config: `mobile/src/navigation/index.tsx` (line 302)
- Chat screen: `mobile/src/screens/ChatScreen.tsx`
- Conversations screen: `mobile/src/screens/ConversationsScreen.tsx`
- Full migration: `sql/MESSAGING_SYSTEM_FRESH_START.sql`
- Quick patch: `sql/UPDATE_CONVERSATION_VIEW.sql`

---

**Status**: ✅ FIXED - Ready to test
**Last Updated**: October 15, 2025
