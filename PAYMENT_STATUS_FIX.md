# Payment Status Update Fix

## Issue
Shipment payment status was not being updated from "pending" to "completed" or "failed" when processing Stripe webhooks. All shipments were remaining in "pending" status even after successful payments.

## Root Cause
The issue was caused by RLS (Row-Level Security) policy restrictions on the shipments table. The existing policies restricted updates:
- Clients could only update their own shipments with specific statuses (`pending`, `open`, `cancelled`)
- Drivers could only update assigned shipments
- Admin users could update all shipments

However, there was no policy specifically allowing the service-role to update the `payment_status` field when processing Stripe webhooks via the backend service.

## Solution
1. Added a new migration (`20250927_fix_payment_status_permissions.sql`) with a policy allowing the service-role to update shipments.
2. Created a test script (`test-payment-status-update.js`) to verify the service-role client can update the payment_status field.

## Deployment Instructions
1. Apply the migration to update RLS policies:
   ```bash
   supabase migration up --db-url [YOUR_DB_URL]
   ```
   
2. Verify the fix works by running the test script with a shipment ID:
   ```bash
   node scripts/test-payment-status-update.js [SHIPMENT_ID]
   ```

3. Monitor Stripe webhook events to ensure payment statuses are being updated correctly in production.

## Additional Notes
- The backend Stripe service is already using the `supabaseAdmin` client with service-role privileges.
- This RLS policy change only affects the service-role's ability to update the payment_status field and doesn't compromise the security of other operations.