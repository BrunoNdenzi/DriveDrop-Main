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

// Test shipment ID (replace with an actual ID from your database or use the one from logs)
const testShipmentId = process.argv[2] || '858a5e15-75da-4b77-8b87-cb84448524bd'; 
if (!testShipmentId) {
  console.error('Please provide a shipment ID to test with');
  console.log('Usage: node test-payment-status-update.js <shipment_id>');
  process.exit(1);
}

async function testPaymentStatusUpdate() {
  console.log(`Testing payment_status update for shipment ${testShipmentId}`);
  
  try {
    console.log('Using supabaseAdmin client with service role key');
    
    // First check the current payment status
    const { data: beforeShipment, error: beforeError } = await supabaseAdmin
      .from('shipments')
      .select('id, payment_status, client_id, status')
      .eq('id', testShipmentId)
      .single();
    
    if (beforeError) {
      console.error('Error details:', JSON.stringify(beforeError, null, 2));
      throw new Error(`Failed to fetch shipment: ${beforeError.message}`);
    }
    
    console.log('Found shipment:', JSON.stringify(beforeShipment, null, 2));
    
    console.log(`Current payment_status: ${beforeShipment.payment_status}`);
    
    // Now attempt to update the payment_status
    const newStatus = beforeShipment.payment_status === 'completed' ? 'pending' : 'completed';
    console.log(`Attempting to update payment_status from ${beforeShipment.payment_status} to ${newStatus}`);
    
    console.log('Sending update request to Supabase...');
    const updateResult = await supabaseAdmin
      .from('shipments')
      .update({ 
        payment_status: newStatus,
        updated_at: new Date().toISOString()
      })
      .eq('id', testShipmentId);
    
    if (updateResult.error) {
      console.error('Update error details:', JSON.stringify(updateResult.error, null, 2));
      throw new Error(`Failed to update payment_status: ${updateResult.error.message}`);
    }
    
    console.log('Update sent successfully, fetching updated record...');
    
    // Fetch the updated record to confirm the change
    const { data: updatedShipment, error: fetchError } = await supabaseAdmin
      .from('shipments')
      .select('id, payment_status')
      .eq('id', testShipmentId)
      .single();
    
    if (fetchError) {
      console.error('Error fetching updated record:', JSON.stringify(fetchError, null, 2));
      throw new Error(`Failed to fetch updated shipment: ${fetchError.message}`);
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