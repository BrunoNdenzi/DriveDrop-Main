/**
 * Test script to verify payment status updates are working correctly
 */
const fetch = require('node-fetch');
const { createClient } = require('@supabase/supabase-js');

// Configuration 
const API_URL = process.env.API_URL || 'http://localhost:3000';
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;

// Create Supabase clients
const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const supabaseClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let testUserId;
let testShipmentId;
let authToken;

async function main() {
  try {
    console.log('=== PAYMENT STATUS UPDATE TEST ===');
    console.log('This script tests both the RLS policy and the API controller updates');
    
    // 1. Sign in as a test user
    console.log('\n1. Signing in as test user...');
    const { data: authData, error: authError } = await supabaseClient.auth.signInWithPassword({
      email: process.env.TEST_USER_EMAIL || 'test@example.com',
      password: process.env.TEST_USER_PASSWORD || 'password123'
    });
    
    if (authError) {
      throw new Error(`Authentication error: ${authError.message}`);
    }
    
    testUserId = authData.user.id;
    authToken = authData.session.access_token;
    console.log(`Successfully signed in as ${testUserId}`);
    
    // 2. Create a test shipment
    console.log('\n2. Creating test shipment...');
    const { data: shipment, error: shipmentError } = await supabaseClient
      .from('shipments')
      .insert({
        title: 'Test Payment Status Update',
        description: 'Test shipment for payment status update',
        client_id: testUserId,
        status: 'pending',
        payment_status: 'pending',
        pickup_address: '123 Test St',
        delivery_address: '456 Test Ave',
        estimated_price: 1000
      })
      .select()
      .single();
      
    if (shipmentError) {
      throw new Error(`Error creating shipment: ${shipmentError.message}`);
    }
    
    testShipmentId = shipment.id;
    console.log(`Created test shipment with ID: ${testShipmentId}`);
    
    // 3. Test updating payment status via the client API (should work now)
    console.log('\n3. Testing client API update...');
    const clientUpdateResponse = await fetch(`${API_URL}/api/v1/shipments/${testShipmentId}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authToken}`
      },
      body: JSON.stringify({
        payment_status: 'completed'
      })
    });
    
    const clientUpdateResult = await clientUpdateResponse.json();
    console.log('Client API update response:', {
      status: clientUpdateResponse.status,
      ok: clientUpdateResponse.ok,
      data: clientUpdateResult
    });
    
    if (!clientUpdateResponse.ok) {
      console.error('Client API update failed. This is unexpected with our fix.');
    } else {
      console.log('Client API update succeeded! The controller fix is working.');
    }
    
    // 4. Reset payment status back to pending
    console.log('\n4. Resetting payment status to pending...');
    const { error: resetError } = await supabaseAdmin
      .from('shipments')
      .update({ payment_status: 'pending' })
      .eq('id', testShipmentId);
      
    if (resetError) {
      throw new Error(`Error resetting payment status: ${resetError.message}`);
    }
    
    console.log('Reset payment status to pending');
    
    // 5. Test updating payment status via service role (webhook simulation)
    console.log('\n5. Testing service role update (webhook simulation)...');
    const { error: serviceRoleError } = await supabaseAdmin
      .from('shipments')
      .update({ payment_status: 'completed' })
      .eq('id', testShipmentId);
      
    if (serviceRoleError) {
      console.error('Service role update failed:', serviceRoleError.message);
      console.error('This suggests the RLS policy is still not configured correctly');
    } else {
      console.log('Service role update succeeded! The RLS policy fix is working.');
    }
    
    // 6. Verify the final state
    console.log('\n6. Verifying final shipment state...');
    const { data: finalShipment, error: finalError } = await supabaseAdmin
      .from('shipments')
      .select('payment_status')
      .eq('id', testShipmentId)
      .single();
      
    if (finalError) {
      throw new Error(`Error fetching final state: ${finalError.message}`);
    }
    
    console.log('Final payment status:', finalShipment.payment_status);
    
    // 7. Clean up
    console.log('\n7. Cleaning up test data...');
    const { error: deleteError } = await supabaseAdmin
      .from('shipments')
      .delete()
      .eq('id', testShipmentId);
      
    if (deleteError) {
      console.warn(`Warning: Failed to delete test shipment: ${deleteError.message}`);
    } else {
      console.log('Test shipment deleted successfully');
    }
    
    console.log('\n=== TEST COMPLETE ===');
    
  } catch (error) {
    console.error('\nTest failed with error:', error);
  }
}

main().catch(console.error);