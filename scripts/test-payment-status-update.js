/**
 * Test script to verify Stripe webhook handling with the service-role client
 * This verifies that the service-role client can update the payment_status field
 */
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

// Load environment variables
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// Create supabase client with service role key
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { persistSession: false },
});

// Test shipment ID (replace with an actual ID from your database)
const testShipmentId = process.argv[2]; 
if (!testShipmentId) {
  console.error('Please provide a shipment ID to test with');
  console.log('Usage: node test-payment-status-update.js <shipment_id>');
  process.exit(1);
}

async function testPaymentStatusUpdate() {
  console.log(`Testing payment_status update for shipment ${testShipmentId}`);
  
  try {
    // First check the current payment status
    const { data: beforeShipment, error: beforeError } = await supabaseAdmin
      .from('shipments')
      .select('id, payment_status')
      .eq('id', testShipmentId)
      .single();
    
    if (beforeError) {
      throw new Error(`Failed to fetch shipment: ${beforeError.message}`);
    }
    
    console.log(`Current payment_status: ${beforeShipment.payment_status}`);
    
    // Now attempt to update the payment_status
    const newStatus = beforeShipment.payment_status === 'completed' ? 'pending' : 'completed';
    
    const { data: updatedShipment, error: updateError } = await supabaseAdmin
      .from('shipments')
      .update({ 
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', testShipmentId)
      .select()
      .single();
    
    if (updateError) {
      throw new Error(`Failed to update payment_status: ${updateError.message}`);
    }
    
    console.log(`Successfully updated payment_status from ${beforeShipment.payment_status} to ${updatedShipment.payment_status}`);
    
    // Revert the change for testing purposes
    const { error: revertError } = await supabaseAdmin
      .from('shipments')
      .update({ 
        payment_status: beforeShipment.payment_status,
        updated_at: new Date().toISOString()
      })
      .eq('id', testShipmentId);
    
    if (revertError) {
      console.warn(`Warning: Failed to revert payment_status: ${revertError.message}`);
    } else {
      console.log(`Reverted payment_status back to ${beforeShipment.payment_status}`);
    }
    
    console.log('Test completed successfully!');
  } catch (error) {
    console.error('Error testing payment_status update:', error.message);
    process.exit(1);
  }
}

testPaymentStatusUpdate();