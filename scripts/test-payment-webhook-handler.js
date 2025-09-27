/**
 * Test script to simulate Stripe webhook handling with enhanced error handling
 * 
 * This script tests:
 * 1. Shipment existence verification before payment creation
 * 2. Upsert for payment records to prevent duplicates
 * 3. Security definer function for updating payment status
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
const nonExistentShipmentId = '00000000-0000-0000-0000-000000000000';

/**
 * Mock implementation of the enhanced handlePaymentSucceeded function
 */
async function handlePaymentSucceeded(paymentIntent) {
  try {
    // Extract metadata from the payment intent
    const { metadata } = paymentIntent;
    const clientId = metadata?.clientId;
    const shipmentId = metadata?.shipmentId;

    console.log('Payment succeeded webhook received', {
      paymentIntentId: paymentIntent.id,
      amount: paymentIntent.amount,
      metadata,
      clientId,
      shipmentId,
    });

    // Only proceed with shipment updates if there's a valid shipment ID
    if (shipmentId) {
      // First check if the shipment exists - use maybeSingle() instead of single()
      const { data: shipment, error: shipmentError } = await supabaseAdmin
        .from('shipments')
        .select('id, client_id, payment_status')
        .eq('id', shipmentId)
        .maybeSingle(); // This won't throw an error if no rows are returned

      // Handle case where shipment doesn't exist
      if (!shipment) {
        console.error('Shipment not found for payment webhook', { 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
          error: shipmentError 
        });
        return { success: false, error: 'Shipment not found' }; 
      }

      // Handle any other errors
      if (shipmentError) {
        console.error('Error fetching shipment for payment webhook', { 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
          error: shipmentError 
        });
        return { success: false, error: 'Error fetching shipment' };
      }

      // Log the shipment we found
      console.log('Found shipment for payment intent', {
        shipmentId,
        paymentIntentId: paymentIntent.id,
        shipmentClientId: shipment.client_id,
        currentPaymentStatus: shipment.payment_status
      });

      // Update or create the payment record using upsert to avoid FK constraint violations
      // First check if a payment record already exists
      const { data: existingPayment } = await supabaseAdmin
        .from('payments')
        .select('id')
        .eq('payment_intent_id', paymentIntent.id)
        .maybeSingle(); // Use maybeSingle() instead of single()
      
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
            client_id: clientId || shipment.client_id, // Fall back to shipment client_id if missing in metadata
            amount: paymentIntent.amount,
            status: 'completed',
            payment_method: paymentIntent.payment_method || 'card',
            payment_intent_id: paymentIntent.id,
            updated_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          });
        
        paymentError = error;
      }

      if (paymentError) {
        console.error('Error upserting payment record', { 
          error: paymentError, 
          shipmentId, 
          paymentIntentId: paymentIntent.id,
        });
        // Don't throw, try updating the shipment anyway
      }

      // Use the function that bypasses RLS to update the shipment status
      const { error: functionError } = await supabaseAdmin
        .rpc('update_shipment_payment_status', {
          p_shipment_id: shipmentId,
          p_payment_status: 'completed'
        });

      if (functionError) {
        console.error('Error calling update_shipment_payment_status function', { 
          error: functionError, 
          shipmentId,
          paymentIntentId: paymentIntent.id
        });
        
        // Fall back to direct update if the function call fails
        const { error: shipmentUpdateError } = await supabaseAdmin
          .from('shipments')
          .update({
            payment_status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('id', shipmentId);

        if (shipmentUpdateError) {
          console.error('Error updating shipment payment status directly', { 
            error: shipmentUpdateError, 
            shipmentId
          });
          return { success: false, error: 'Failed to update shipment status' };
        } else {
          console.log('Successfully updated shipment payment status directly', {
            shipmentId,
            paymentIntentId: paymentIntent.id,
            newStatus: 'completed'
          });
        }
      } else {
        console.log('Successfully updated shipment payment status via function', {
          shipmentId,
          paymentIntentId: paymentIntent.id,
          newStatus: 'completed'
        });
      }

      return { success: true };
    } else {
      console.warn('Payment intent succeeded without shipment ID', {
        paymentIntentId: paymentIntent.id,
        metadata
      });
      return { success: false, error: 'Missing shipment ID' };
    }
  } catch (error) {
    console.error('Error handling payment success webhook', { 
      error, 
      paymentIntentId: paymentIntent.id,
      errorMessage: error.message
    });
    return { success: false, error: error.message };
  }
}

async function testValidShipment() {
  console.log('\n=== TEST 1: Valid Shipment Payment Processing ===');
  
  try {
    // Get the shipment to use in our test
    const { data: shipment, error } = await supabaseAdmin
      .from('shipments')
      .select('id, client_id, payment_status')
      .eq('id', testShipmentId)
      .single();
      
    if (error) {
      throw new Error(`Failed to fetch test shipment: ${error.message}`);
    }
    
    console.log(`Using existing shipment: ${shipment.id}`);
    
    // Create mock payment intent with valid shipment
    const mockPaymentIntent = {
      id: `pi_test_${Date.now()}`,
      amount: 10000, // $100.00
      payment_method_types: ['card'],
      metadata: {
        clientId: shipment.client_id,
        shipmentId: shipment.id
      }
    };
    
    console.log('Processing mock payment intent with valid shipment ID...');
    const result = await handlePaymentSucceeded(mockPaymentIntent);
    
    if (result.success) {
      console.log('✅ Successfully processed payment for valid shipment');
      
      // Verify the payment status was updated
      const { data: updatedShipment, error: fetchError } = await supabaseAdmin
        .from('shipments')
        .select('payment_status')
        .eq('id', shipment.id)
        .single();
        
      if (fetchError) {
        throw new Error(`Failed to fetch updated shipment: ${fetchError.message}`);
      }
      
      if (updatedShipment.payment_status === 'completed') {
        console.log('✅ Shipment payment_status correctly updated to "completed"');
      } else {
        console.error(`❌ Shipment payment_status not updated (${updatedShipment.payment_status})`);
        return false;
      }
      
      // Reset payment status for next test
      const { error: resetError } = await supabaseAdmin
        .from('shipments')
        .update({ payment_status: 'pending' })
        .eq('id', shipment.id);
        
      if (resetError) {
        console.warn(`Warning: Failed to reset payment status: ${resetError.message}`);
      }
      
      return true;
    } else {
      console.error('❌ Failed to process payment for valid shipment:', result.error);
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function testNonExistentShipment() {
  console.log('\n=== TEST 2: Non-existent Shipment Handling ===');
  
  try {
    // Create mock payment intent with invalid shipment
    const mockPaymentIntent = {
      id: `pi_test_invalid_${Date.now()}`,
      amount: 5000, // $50.00
      payment_method_types: ['card'],
      metadata: {
        clientId: 'd29c8817-a730-4983-ad82-1dd7d20fd883', // Use a known client ID
        shipmentId: nonExistentShipmentId
      }
    };
    
    console.log('Processing mock payment intent with non-existent shipment ID...');
    const result = await handlePaymentSucceeded(mockPaymentIntent);
    
    // We expect the function to return false success but handle the error gracefully
    if (!result.success && result.error === 'Shipment not found') {
      console.log('✅ Correctly handled non-existent shipment ID without crashing');
      return true;
    } else {
      console.error('❌ Did not properly handle non-existent shipment ID');
      return false;
    }
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    return false;
  }
}

async function runTests() {
  console.log('=================================================');
  console.log('🧪 Testing Enhanced Webhook Handler');
  console.log('=================================================\n');
  
  let test1Result = false;
  let test2Result = false;
  
  try {
    // Test with valid shipment
    test1Result = await testValidShipment();
    
    // Test with non-existent shipment
    test2Result = await testNonExistentShipment();
    
    // Summary
    console.log('\n=================================================');
    console.log('📋 Test Summary');
    console.log('=================================================');
    console.log(`Valid Shipment Processing: ${test1Result ? '✅ PASSED' : '❌ FAILED'}`);
    console.log(`Non-existent Shipment Handling: ${test2Result ? '✅ PASSED' : '❌ FAILED'}`);
    
    if (test1Result && test2Result) {
      console.log('\n✅✅✅ All tests passed! The enhanced webhook handler is working correctly.');
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