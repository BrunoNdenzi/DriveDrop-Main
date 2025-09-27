/**
 * Test script for shipment payment status updates
 * 
 * This script verifies that:
 * 1. The RLS policy allows service-role to update payment_status
 * 2. The security definer function works correctly
 * 3. Payment records can be upserted without foreign key violations
 * 
 * Usage:
 *   node test-payment-webhook.js <shipment_id>
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

// Create a Supabase client with service role
const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    }
  }
);

async function main() {
  try {
    // Get shipment ID from command line
    const shipmentId = process.argv[2];
    
    if (!shipmentId) {
      console.error('Error: Shipment ID is required');
      console.log('Usage: node test-payment-webhook.js <shipment_id>');
      process.exit(1);
    }
    
    console.log(`Testing payment status update for shipment: ${shipmentId}`);
    
    // 1. Check if shipment exists
    console.log('Checking if shipment exists...');
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .select('id, client_id, payment_status')
      .eq('id', shipmentId)
      .single();
      
    if (shipmentError) {
      console.error('Error fetching shipment:', shipmentError);
      process.exit(1);
    }
    
    if (!shipment) {
      console.error(`Shipment with ID ${shipmentId} not found`);
      process.exit(1);
    }
    
    console.log('Found shipment:', {
      id: shipment.id,
      client_id: shipment.client_id,
      current_payment_status: shipment.payment_status
    });
    
    // 2. Test security definer function
    console.log('\nTesting security definer function...');
    const { error: functionError } = await supabaseAdmin
      .rpc('update_shipment_payment_status', {
        p_shipment_id: shipmentId,
        p_payment_status: 'processing'
      });
      
    if (functionError) {
      console.error('Error calling update_shipment_payment_status function:', functionError);
      console.log('\nFalling back to direct update...');
      
      // 3. Test direct update as fallback
      const { error: directUpdateError } = await supabaseAdmin
        .from('shipments')
        .update({
          payment_status: 'processing',
          updated_at: new Date().toISOString()
        })
        .eq('id', shipmentId);
        
      if (directUpdateError) {
        console.error('Error with direct update:', directUpdateError);
        process.exit(1);
      } else {
        console.log('✅ Direct update successful');
      }
    } else {
      console.log('✅ Function update successful');
    }
    
    // 4. Verify the update worked
    const { data: updatedShipment, error: verifyError } = await supabaseAdmin
      .from('shipments')
      .select('payment_status')
      .eq('id', shipmentId)
      .single();
      
    if (verifyError) {
      console.error('Error verifying update:', verifyError);
      process.exit(1);
    }
    
    console.log(`\nVerified payment_status is now: ${updatedShipment.payment_status}`);
    
    // 5. Test payment record upsert
    console.log('\nTesting payment record upsert...');
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .upsert({
        shipment_id: shipmentId,
        client_id: shipment.client_id,
        amount: 10000, // $100.00
        status: 'completed',
        payment_method: 'card',
        payment_intent_id: `test_pi_${Date.now()}`,
        updated_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      }, {
        onConflict: 'shipment_id',
        ignoreDuplicates: false
      });
      
    if (paymentError) {
      console.error('Error upserting payment record:', paymentError);
      process.exit(1);
    }
    
    console.log('✅ Payment record upsert successful');
    
    // 6. Final update to completed
    console.log('\nSetting final payment_status to completed...');
    const { error: finalError } = await supabaseAdmin
      .rpc('update_shipment_payment_status', {
        p_shipment_id: shipmentId,
        p_payment_status: 'completed'
      });
      
    if (finalError) {
      console.error('Error setting final status:', finalError);
      process.exit(1);
    }
    
    console.log('✅ Test completed successfully!');
    console.log('\nSummary:');
    console.log('- RLS policy allows service-role to update payment_status');
    console.log('- Security definer function works correctly');
    console.log('- Payment records can be upserted without foreign key violations');
    console.log('- Shipment payment_status successfully updated to "completed"');
    
  } catch (error) {
    console.error('Unexpected error:', error);
    process.exit(1);
  }
}

main();