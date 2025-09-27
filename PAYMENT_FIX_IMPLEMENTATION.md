# Fixing Payment Status Updates - Implementation Guide

This guide provides step-by-step instructions to fix the payment status update issues in the DriveDrop application.

## Background

Payments processed via Stripe webhooks are not updating the `payment_status` field in the shipments table due to:
1. Missing RLS (Row-Level Security) policies for the service-role
2. Foreign key constraint violations when creating payment records
3. Error handling issues with non-existent shipments

## Step 1: Apply the SQL Migration

The migration adds necessary permissions for the service-role to update shipment records.

```bash
# Navigate to your project root
cd /path/to/drive-drop

# Apply the migration
npx supabase migration up
```

This migration:
- Grants permissions to the service-role
- Creates a security definer function to bypass RLS
- Sets up appropriate policies for webhook processing

## Step 2: Update the Webhook Handler

Replace the `handlePaymentSucceeded` method in `backend/src/services/stripe.service.ts` with the enhanced version:

1. Open the file:
   ```
   backend/src/services/stripe.service.ts
   ```

2. Locate the `handlePaymentSucceeded` method (around line 320)

3. Replace it with the enhanced implementation from:
   ```
   backend/src/services/stripe-webhook-final-fix.js
   ```

4. Make similar enhancements to the `handlePaymentFailed` and `handlePaymentCanceled` methods:
   - Add shipment existence verification using `maybeSingle()` instead of `single()`
   - Check for existing payment records first, then update or insert as needed
   - Implement the security definer function with fallback
   - Add comprehensive error handling
   - Make sure to handle the case where shipment doesn't exist

## Step 3: Test the Implementation

1. Run the test script with a valid shipment ID:
   ```bash
   node scripts/test-payment-webhook.js <shipment_id>
   ```

2. Verify the script reports success for:
   - RLS policy allowing service-role updates
   - Security definer function working correctly
   - Payment record upsert without foreign key violations
   - Shipment payment status updating to "completed"

## Step 4: Verify in Production

1. Process a test payment through the app

2. Check that the payment webhook is properly received by monitoring the logs:
   ```bash
   # View Railway logs or your logging service
   railway logs -s backend -f
   ```

3. Verify the shipment's payment_status is updated from "pending" to "completed"

## Troubleshooting

If you encounter any issues:

1. **Foreign Key Constraint Errors**:
   - Check that shipment IDs in payment intents match actual shipments
   - Verify the webhook handler is properly checking shipment existence

2. **Permission Issues**:
   - Ensure the migration was applied successfully
   - Verify the service role key is correctly configured

3. **Webhook Not Triggering**:
   - Check the Stripe webhook configuration
   - Verify the webhook signing secret is properly set

For assistance, refer to:
- PAYMENT_STATUS_FIX.md - Original policy fix
- PAYMENT_WEBHOOK_ENHANCEMENT.md - Additional webhook improvements