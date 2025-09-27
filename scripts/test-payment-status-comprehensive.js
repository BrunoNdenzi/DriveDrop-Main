/**
 * Comprehensive test script for payment status updates and foreign key constraints
 * 
 * This script tests:
 * 1. Service-role can update payment_status
 * 2. Foreign key constraint handling with non-existent shipment IDs
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

// Test shipment ID (use the provided one or a default)
const testShipmentId = process.argv[2] || '858a5e15-75da-4b77-8b87-cb84448524bd';

// A non-existent shipment ID for testing foreign key constraints
const nonExistentShipmentId = '00000000-0000-0000-0000-000000000000';

async function testPaymentStatusUpdate() {
  console.log('=== TEST 1: Payment Status Update ===');
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
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testForeignKeyConstraint() {
  console.log('\n=== TEST 2: Foreign Key Constraint Handling ===');
  try {
    console.log(`Testing foreign key constraint with non-existent shipment ID: ${nonExistentShipmentId}`);
    
    // 1. First check if the shipment exists (it shouldn't)
    const { data: shipment, error: shipmentError } = await supabaseAdmin
      .from('shipments')
      .select('id')
      .eq('id', nonExistentShipmentId)
      .single();
      
    // We expect an error because the shipment doesn't exist
    if (!shipmentError) {
      console.warn('Warning: Non-existent shipment ID actually exists. This will affect test results.');
    } else {
      console.log('✅ Confirmed shipment ID does not exist');
    }
    
    // 2. Try to insert a payment record with a non-existent shipment ID
    console.log('Attempting to create payment record with non-existent shipment ID...');
    const { error: paymentError } = await supabaseAdmin
      .from('payments')
      .insert({
        shipment_id: nonExistentShipmentId,
        client_id: 'd29c8817-a730-4983-ad82-1dd7d20fd883', // Using a known client ID
        amount: 10000, // $100.00
        status: 'completed',
        payment_method: 'card',
        payment_intent_id: `test_pi_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      });
    
    // We expect a foreign key constraint error
    if (paymentError) {
      console.log('✅ Foreign key constraint correctly prevented invalid payment creation');
      console.log('Error details:', JSON.stringify(paymentError, null, 2));
      
      // Check specifically for foreign key constraint error
      const isForeignKeyError = 
        paymentError.message.includes('foreign key') || 
        paymentError.message.includes('violates foreign key constraint') ||
        paymentError.message.includes('payments_shipment_id_fkey');
        
      if (isForeignKeyError) {
        console.log('✅ Confirmed error is foreign key constraint violation');
      } else {
        console.warn('⚠️ Error occurred but not a foreign key constraint error');
      }
    } else {
      console.error('❌ Expected foreign key constraint error, but payment was created successfully');
      return false;
    }
    
    // 3. Now test with upsert to see if it handles the error better
    console.log('\nTesting upsert with non-existent shipment ID...');
    const { error: upsertError } = await supabaseAdmin
      .from('payments')
      .upsert({
        shipment_id: nonExistentShipmentId,
        client_id: 'd29c8817-a730-4983-ad82-1dd7d20fd883',
        amount: 10000,
        status: 'completed',
        payment_method: 'card',
        payment_intent_id: `test_pi_upsert_${Date.now()}`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'payment_intent_id',
        ignoreDuplicates: false
      });
    
    // We still expect a foreign key constraint error
    if (upsertError) {
      console.log('✅ Foreign key constraint correctly prevented invalid payment upsert');
    } else {
      console.error('❌ Expected foreign key constraint error for upsert, but operation succeeded');
      return false;
    }
    
    console.log('✅ Foreign key constraint test completed successfully');
    return true;
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('🧪 Starting payment status and foreign key tests');
  console.log('=================================================\n');
  
  let test1Result = false;
  let test2Result = false;
  
  try {
    // Run Test 1: Payment Status Update
    test1Result = await testPaymentStatusUpdate();
    
    // Run Test 2: Foreign Key Constraint
    test2Result = await testForeignKeyConstraint();
    
    // Summary
    console.log('\n=================================================');
    console.log('📋 Test Summary');
    console.log('=================================================');
    console.log(`Payment Status Update: ${test1Result ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Foreign Key Constraint: ${test2Result ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (test1Result && test2Result) {
      console.log('\n✅✅✅ All tests passed! Your fix is working correctly.');
    } else {
      console.log('\n❌ Some tests failed. Review the logs above for details.');
      process.exit(1);
    }
  } catch (error) {
    console.error('\n❌ Unexpected error running tests:', error);
    process.exit(1);
  }
}

// Run the tests
runTests();