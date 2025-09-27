# Payment Webhook Enhancement - Final Fix

## Issues Fixed

After thorough testing, we've addressed three critical issues in the payment webhook system:

1. **RLS Policy Issue**: Added proper permissions for the service-role to update payment_status field
2. **Foreign Key Constraint Violations**: Implemented shipment existence verification
3. **Error Handling**: Fixed issues with error handling, especially for non-existent shipment IDs

## Key Changes

### 1. Enhanced Error Handling

The main improvements to the webhook handler include:

```javascript
// Use maybeSingle() instead of single() to handle non-existent records gracefully
const { data: shipment, error: shipmentError } = await supabaseAdmin
  .from('shipments')
  .select('id, client_id, payment_status')
  .eq('id', shipmentId)
  .maybeSingle(); 

// Handle case where shipment doesn't exist
if (!shipment) {
  logger.error('Shipment not found for payment webhook', { 
    shipmentId, 
    paymentIntentId: paymentIntent.id,
    error: shipmentError 
  });
  return; // Exit gracefully to acknowledge webhook
}
```

### 2. Better Payment Record Management

Instead of using upsert (which requires unique constraints), we check if a payment record exists and then either update or insert:

```javascript
// First check if a payment record already exists
const { data: existingPayment } = await supabaseAdmin
  .from('payments')
  .select('id')
  .eq('payment_intent_id', paymentIntent.id)
  .maybeSingle();

let paymentError;

if (existingPayment) {
  // Update existing payment
  const { error } = await supabaseAdmin
    .from('payments')
    .update({
      status: 'completed',
      updated_at: new Date().toISOString()
    })
    .eq('id', existingPayment.id);
  
  paymentError = error;
} else {
  // Create new payment record
  const { error } = await supabaseAdmin
    .from('payments')
    .insert({
      shipment_id: shipmentId,
      client_id: clientId || shipment.client_id,
      amount: paymentIntent.amount,
      status: 'completed',
      payment_method: paymentIntent.payment_method_types?.[0] || 'card',
      payment_intent_id: paymentIntent.id,
      updated_at: new Date().toISOString(),
      created_at: new Date().toISOString()
    });
  
  paymentError = error;
}
```

### 3. Robust Status Update

Implemented a primary method with fallback:

```javascript
// Use the function that bypasses RLS to update the shipment status
const { error: functionError } = await supabaseAdmin
  .rpc('update_shipment_payment_status', {
    p_shipment_id: shipmentId,
    p_payment_status: 'completed'
  });

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

## Testing Results

All tests are now passing:
- ✅ Service role can update payment_status
- ✅ Foreign key constraint errors are handled properly
- ✅ Non-existent shipments are handled gracefully

## Implementation

1. Apply the SQL migration to add RLS policies
2. Replace the webhook handler implementation with the enhanced version
3. Follow the detailed steps in PAYMENT_FIX_IMPLEMENTATION.md

These changes ensure that Stripe webhooks correctly update payment status without causing errors, even in edge cases.