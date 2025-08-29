/**
 * Payment API Test Utility
 * Use this utility to test the connectivity to the payment API endpoints
 */
import { getApiUrl } from '../utils/environment';
import { supabase } from '../lib/supabase';

/**
 * Test Stripe payment service API
 */
export async function testPaymentApi() {
  try {
    console.log('=== PAYMENT API TEST ===');

    // 1. Log environment
    console.log('API URL:', getApiUrl());

    // 2. Check auth status
    const { data: authData, error: authError } =
      await supabase.auth.getSession();
    console.log(
      'Auth Status:',
      authData.session ? 'Authenticated' : 'Not authenticated'
    );
    if (authError) {
      console.error('Auth Error:', authError);
      return {
        success: false,
        error: 'Authentication error',
        details: authError,
      };
    }

    if (!authData.session) {
      return { success: false, error: 'Not authenticated' };
    }

    const token = authData.session.access_token;

    // 3. Test API health endpoint
    try {
      console.log('Testing API health endpoint...');
      const healthResponse = await fetch(`${getApiUrl()}/api/health`, {
        method: 'GET',
      });
      console.log(
        'Health Status:',
        healthResponse.status,
        healthResponse.statusText
      );
      if (!healthResponse.ok) {
        return { success: false, error: 'API health check failed' };
      }
    } catch (healthError) {
      console.error('Health Endpoint Error:', healthError);
      return {
        success: false,
        error: 'Cannot reach API',
        details: healthError,
      };
    }

    // 4. Test payment config endpoint
    try {
      console.log('Testing payment config endpoint...');
      const configResponse = await fetch(
        `${getApiUrl()}/api/v1/payments/config`,
        {
          method: 'GET',
        }
      );
      console.log(
        'Config Status:',
        configResponse.status,
        configResponse.statusText
      );
      if (!configResponse.ok) {
        return { success: false, error: 'Payment config endpoint failed' };
      }
      const configData = await configResponse.json();
      console.log('Config Data:', configData);
    } catch (configError) {
      console.error('Config Endpoint Error:', configError);
      return {
        success: false,
        error: 'Cannot fetch payment config',
        details: configError,
      };
    }

    // 5. Test payment intent creation with minimal payload
    try {
      console.log('Testing payment intent creation...');
      const testPayload = {
        amount: 100, // $1.00 in cents
        currency: 'usd',
        shipmentId: 'test-shipment-id',
        description: 'API Test Payment',
      };

      const intentResponse = await fetch(
        `${getApiUrl()}/api/v1/payments/create-intent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify(testPayload),
        }
      );

      console.log(
        'Create Intent Status:',
        intentResponse.status,
        intentResponse.statusText
      );
      const intentResponseData = await intentResponse.text();

      try {
        // Try to parse as JSON
        const jsonData = JSON.parse(intentResponseData);
        console.log('Create Intent Response:', jsonData);
      } catch {
        // If not valid JSON, log as text
        console.log('Create Intent Raw Response:', intentResponseData);
      }

      if (!intentResponse.ok) {
        return {
          success: false,
          error: 'Payment intent creation failed',
          status: intentResponse.status,
          response: intentResponseData,
        };
      }
    } catch (intentError) {
      console.error('Intent Creation Error:', intentError);
      return {
        success: false,
        error: 'Cannot create payment intent',
        details: intentError,
      };
    }

    console.log('=== PAYMENT API TEST COMPLETE ===');
    return { success: true };
  } catch (error) {
    console.error('Payment API Test Failed:', error);
    return { success: false, error: 'Test failed', details: error };
  }
}
