# Payment Status Update Fix

## Issue Overview
Shipment payment status was not being updated from "pending" to "completed" or "failed" in two scenarios:
1. When processing Stripe webhooks through the backend service
2. When the mobile app directly attempts to update the payment_status field

## Root Causes
1. **RLS Policy Restrictions**: The existing RLS policies restricted updates to the shipments table:
   - Clients could only update their own shipments with specific statuses (`pending`, `open`, `cancelled`)
   - Drivers could only update assigned shipments
   - Admin users could update all shipments
   - There was no policy specifically allowing the service-role to update the `payment_status` field when processing Stripe webhooks

2. **Backend Controller Restriction**: The `updateShipment` method in `shipment.controller.ts` had an `allowedFields` array that didn't include `payment_status`, causing client-side updates to be filtered out.

3. **Webhook Handler Robustness**: The webhook handler for payment success was not properly verifying shipment existence or handling errors gracefully.

## Solution - Phase 1 (RLS Policy Fix)
1. Added a new migration (`20250927_fix_payment_status_permissions.sql`) with a policy allowing the service-role to update shipments.
2. Created a test script (`test-payment-status-update.js`) to verify the service-role client can update the payment_status field.

## Solution - Phase 2 (Mobile App & Backend Updates)
1. **Backend Controller Update**: Updated the `allowedFields` array in `shipment.controller.ts` to include `payment_status`
2. **Enhanced Webhook Handler**: Improved the webhook handler in `stripe.service.ts` to handle payment success events more robustly
3. **Mobile App Updates**:
   - Added a new `updatePaymentStatus` method to ShipmentService
   - Modified StripePaymentForm to update payment status after successful payment
4. **Additional Testing**: Created comprehensive test scripts to verify all aspects of the fix

## Deployment Instructions
1. Apply the migration to update RLS policies (already completed in Phase 1):
   ```bash
   supabase migration up --db-url [YOUR_DB_URL]
   ```

2. Deploy the updated backend code with the following changes:
   - Update to `shipment.controller.ts` - Allow payment_status in allowedFields
   - Update to `stripe.service.ts` - Enhanced webhook handler

3. Deploy the updated mobile app with:
   - New `updatePaymentStatus` method in ShipmentService
   - Modified StripePaymentForm component

4. Verify the complete fix works by running the comprehensive test script:
   ```bash
   cd scripts
   ./test-payment-status.bat
   ```

## Detailed Changes

### 1. Backend Controller Update
Updated the `allowedFields` array in `shipment.controller.ts` to include `payment_status`:

```typescript
const allowedFields = [
  'title', 'description', 'pickup_address', 'pickup_city', 'pickup_state', 'pickup_zip',
  'pickup_notes', 'pickup_date', 'delivery_address', 'delivery_city', 'delivery_state', 
  'delivery_zip', 'delivery_notes', 'delivery_date', 'vehicle_type', 'cargo_type',
  'weight', 'dimensions', 'special_instructions', 'estimated_price', 'final_price',
  'is_accident_recovery', 'distance', 'payment_status'  // Added payment_status
];
```

### 2. Enhanced Webhook Handler
Improved the `handlePaymentSucceeded` method in `stripe.service.ts` to:
- Verify the shipment exists before updating
- Handle foreign key constraint errors gracefully
- Provide better logging and error handling
- Create missing payment records when needed

### 3. Added Direct Payment Status Update Method
Added a new method to `ShipmentService` in the mobile app to directly update payment status:

```typescript
/**
 * Update shipment payment status
 */
static async updatePaymentStatus(shipmentId: string, status: string): Promise<any> {
  try {
    console.log(`Updating payment status for shipment ${shipmentId} to ${status}`);
    
    // Validate input
    if (!shipmentId) {
      throw new Error('Invalid shipment ID');
    }
    
    if (!['pending', 'completed', 'failed', 'refunded'].includes(status)) {
      throw new Error(`Invalid payment status: ${status}`);
    }

    const { data, error } = await supabase
      .from('shipments')
      .update({
        payment_status: status,
        updated_at: new Date().toISOString(),
      })
      .eq('id', shipmentId)
      .select()
      .single();

    if (error) {
      console.error('Error updating payment status:', error);
      throw error;
    }

    console.log('Payment status updated successfully:', data);
    return data;
  } catch (error) {
    console.error('ShipmentService.updatePaymentStatus error:', error);
    throw error;
  }
}
```

## Additional Notes
- The mobile app now attempts to update the payment status directly after successful payment confirmation for immediate feedback, with the webhook serving as a backup
- The backend webhook handler now includes improved error handling and will create missing payment records if needed
- These changes do not compromise the security of operations and work together with the previous RLS policy fix