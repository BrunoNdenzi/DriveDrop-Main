# Payment Status Enhancement

## Additional Payment Webhook Improvements

Following up on our initial fix documented in `PAYMENT_STATUS_FIX.md`, we've discovered that webhooks might encounter a foreign key constraint violation when trying to create payment records. This document provides additional enhancements to make the webhook handler more robust.

## Issue
When processing a webhook event, the error `payments_shipment_id_fkey` can occur if:
1. The webhook tries to create a payment record with a `shipment_id` that doesn't exist
2. The metadata in the payment intent has a `shipmentId` that doesn't match any shipment in the database

Error details from logs:
```
Failed to update payment record: Error: new row for relation "payments" violates check constraint "payments_shipment_id_fkey"
Detail: Failing row contains (94ea6348-27ef-4101-97e6-e726e558a051, d29c8817-a730-4983-ad82-1dd7d20fd883, 100000, completed, card, pi_3SHHK3FE315KjCo41lJBdeml, null, null, null, 2025-09-28 08:01:58.993975, 2025-09-28 08:01:58.993975, null).
```

## Enhanced Solution

We've created a robust webhook handler implementation in `payment-webhook-handler-fix.js` with the following improvements:

1. **Shipment Existence Verification**: Check if the shipment exists before attempting to create/update payment records
   ```javascript
   // First check if the shipment exists
   const { data: shipment, error: shipmentError } = await supabaseAdmin
     .from('shipments')
     .select('id, client_id, payment_status')
     .eq('id', shipmentId)
     .single();

   if (shipmentError || !shipment) {
     // Handle gracefully without throwing errors
     logger.error('Shipment not found for payment webhook', { 
       shipmentId, 
       paymentIntentId: paymentIntent.id,
     });
     return; // Exit gracefully
   }
   ```

2. **Upsert Instead of Insert**: Use upsert to handle potential duplicate records
   ```javascript
   // Update or create the payment record using upsert to avoid FK constraint violations
   const { error: paymentError } = await supabaseAdmin
     .from('payments')
     .upsert({
       // Payment data here
     }, {
       onConflict: 'payment_intent_id', 
       ignoreDuplicates: false
     });
   ```

3. **Use of Security Definer Function**: Primary method to update payment status
   ```javascript
   // Use the function that bypasses RLS to update the shipment status
   const { error: functionError } = await supabaseAdmin
     .rpc('update_shipment_payment_status', {
       p_shipment_id: shipmentId,
       p_payment_status: 'completed'
     });
   ```

4. **Direct Update Fallback**: Attempt a direct update if the function fails
   ```javascript
   if (functionError) {
     // Fall back to direct update if the function call fails
     const { error: shipmentUpdateError } = await supabaseAdmin
       .from('shipments')
       .update({
         payment_status: 'completed',
         updated_at: new Date().toISOString(),
       })
       .eq('id', shipmentId);
   }
   ```

5. **Comprehensive Logging**: Better error information and tracing
   ```javascript
   logger.error('Error upserting payment record', { 
     error: paymentError, 
     shipmentId, 
     paymentIntentId: paymentIntent.id,
     errorMessage: paymentError.message,
     errorDetails: paymentError.details
   });
   ```

## Implementation Steps

1. Ensure the SQL migration from the initial fix has been applied
2. Replace the `handlePaymentSucceeded` method in `stripe.service.ts` with the enhanced implementation from `payment-webhook-handler-fix.js`
3. Apply similar enhancements to `handlePaymentFailed` and `handlePaymentCanceled` methods
4. Deploy the changes to your environment

## Testing

After implementing these changes:

1. Verify that webhooks are correctly configured in Stripe
2. Check the webhook signing secret is set in your environment variables
3. Use Stripe test cards to simulate successful and failed payments
4. Monitor logs for any remaining issues

These enhancements will make the payment system more robust and resilient to edge cases and errors.