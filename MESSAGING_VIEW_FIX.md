# Messaging Fix - conversation_summaries View Missing Column

**Issue:** Messages screen showing error:
```
Failed to load conversations
column conversation_summaries.last_message_at does not exist
```

**Root Cause:** The `conversation_summaries` view in Supabase is missing the `last_message_at` column. This likely happened during a database migration or manual SQL update that didn't include all required columns.

---

## Quick Fix

### Run this SQL in Supabase:

1. **Go to:** Supabase Dashboard → SQL Editor → New Query

2. **Copy & Paste:** `backend/scripts/fix-conversation-view.sql`

3. **Run the script** (Click "Run" or Ctrl+Enter)

4. **Verify:** The verification queries at the bottom should show:
   - 12 columns total
   - Including `last_message_at` column
   - Test query should return data without errors

---

## What the Fix Does

✅ Drops the existing (incomplete) `conversation_summaries` view

✅ Recreates it with **all 12 required columns**:
- shipment_id
- shipment_title  
- shipment_status
- client_id
- driver_id
- client_name
- client_avatar
- driver_name
- driver_avatar
- last_message_content
- **last_message_at** ← **This was missing!**
- unread_count

✅ Handles NULL values properly (for unassigned drivers)

✅ Applies RLS permissions

---

## After Running the Fix

1. **Restart your mobile app:**
   ```bash
   cd mobile
   npx expo start -c
   ```

2. **Login with test account:**
   - Email: client@test.com
   - Password: Test123!

3. **Go to Messages tab:**
   - Should load without errors
   - Shows "No conversations yet" if no messages
   - Ready to start messaging once shipments have drivers assigned

---

## Why This Happened

During production database setup, one of these likely occurred:
- View was recreated from an old script missing the column
- Manual SQL edit didn't include all columns
- Database restore from incomplete backup
- Schema migration that didn't update views

---

## Prevention

✅ Always use the complete SQL scripts from `sql/` folder

✅ Test views after any database changes:
```sql
SELECT * FROM conversation_summaries LIMIT 1;
```

✅ Regenerate TypeScript types after DB changes:
```bash
npx supabase gen types typescript --project-id <your-project-id>
```

---

**Status:** Fix ready to apply 🚀
