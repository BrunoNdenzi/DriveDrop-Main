import { supabase } from '../lib/supabase';
// Import the environment utility functions directly with the correct path
import { getApiUrl } from '../utils/environment';
import { Alert } from 'react-native';

export interface PaymentIntent {
  id: string;
  client_secret: string;
  amount: number;
  currency: string;
  status: string;
  created: number;
}

export interface PaymentMethodRequest {
  type: 'card';
  card: {
    number: string;
    exp_month: string;
    exp_year: string;
    cvc: string;
  };
  billing_details: {
    name: string;
    address: {
      line1: string;
      city: string;
      state: string;
      postal_code: string;
      country: string;
    };
  };
}

export interface StripeConfig {
  publishableKey: string;
}

class PaymentService {
  private readonly apiUrl: string;

  constructor() {
    this.apiUrl = `${getApiUrl()}/api/v1/payments`;
    console.log('Payment service initialized with API URL:', this.apiUrl);
  }

  /**
   * Test API connectivity
   * This is useful for troubleshooting API connection issues
   */
  async testApiConnectivity(): Promise<boolean> {
    try {
      console.log('Testing API connectivity to:', `${this.apiUrl}/config`);
      const response = await fetch(`${this.apiUrl}/config`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      console.log('API connectivity test result:', {
        status: response.status,
        statusText: response.statusText,
        ok: response.ok,
      });

      return response.ok;
    } catch (error) {
      console.error('API connectivity test failed:', error);
      return false;
    }
  }

  /**
   * Get Stripe configuration
   */
  async getStripeConfig(): Promise<StripeConfig> {
    try {
      const response = await fetch(`${this.apiUrl}/config`);
      if (!response.ok) {
        throw new Error('Failed to get Stripe configuration');
      }
      return await response.json();
    } catch (error) {
      console.error('Error getting Stripe config:', error);
      throw error;
    }
  }

  /**
   * Create a payment intent for a shipment
   */
  async createPaymentIntent(
    shipmentId: string,
    amount: number,
    description?: string
  ): Promise<PaymentIntent> {
    try {
      // Get the user session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('User not authenticated');
      }

      const response = await fetch(`${this.apiUrl}/create-intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          amount,
          shipmentId,
          description,
        }),
      });

      // Log the request payload for debugging
      console.log('Payment intent request payload:', {
        amount,
        shipmentId,
        description,
      });

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment intent API error response:', errorData);
        throw new Error(
          errorData.message ||
            errorData.error ||
            'Failed to create payment intent'
        );
      }

      // Parse response
      const responseData = await response.json();
      console.log('Payment intent API response:', responseData);

      // Extract data from the response - handle both nested data formats
      let paymentIntent: PaymentIntent;

      if (responseData.data && responseData.data.data) {
        // Handle double-nested data structure
        paymentIntent = responseData.data.data;
        console.log('Extracted payment intent from double-nested data');
      } else if (responseData.data) {
        // Handle single-nested data structure
        paymentIntent = responseData.data;
        console.log('Extracted payment intent from single-nested data');
      } else {
        // Fallback to direct properties if no data nesting
        paymentIntent = responseData;
        console.log('Extracted payment intent from direct response');
      }

      // Log the extracted payment intent ID
      console.log('Extracted payment intent ID:', paymentIntent.id);

      if (!paymentIntent.id) {
        console.error(
          'Payment intent ID is missing in the response',
          responseData
        );
        throw new Error('Invalid payment intent response: Missing ID');
      }

      return paymentIntent;
    } catch (error) {
      console.error('Error creating payment intent (full details):', error);

      // Log more specific details depending on error type
      if (error instanceof Error) {
        console.error('Error message:', error.message);
        console.error('Error stack:', error.stack);
      } else if (error instanceof Response) {
        console.error('Response status:', error.status);
        console.error('Response statusText:', error.statusText);
      }

      // Check if there's a network issue
      if (
        error instanceof TypeError &&
        error.message.includes('Network request failed')
      ) {
        Alert.alert(
          'Network Error',
          'Could not connect to the payment server. Please check your internet connection and try again.'
        );
        throw new Error('Network connection failed');
      }

      // Display more specific error message to user
      Alert.alert(
        'Payment Error',
        error instanceof Error
          ? error.message
          : 'Failed to initialize payment. Please try again later.'
      );
      throw error;
    }
  }

  /**
   * Confirm a payment intent with payment method
   */
  async confirmPaymentIntent(
    paymentIntentId: string,
    paymentMethod: PaymentMethodRequest
  ): Promise<{ success: boolean; error?: string }> {
    try {
      // Get the user session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        throw new Error('User not authenticated');
      }

      // Validate payment intent ID
      if (!paymentIntentId) {
        console.error('Payment intent ID is undefined or empty');
        throw new Error('Missing payment intent ID');
      }

      console.log('Confirming payment intent with ID:', paymentIntentId);
      console.log('Payment method (redacted):', {
        type: paymentMethod.type,
        card: {
          ...paymentMethod.card,
          number: '****' + paymentMethod.card.number.slice(-4),
          cvc: '***',
        },
      });

      // Use a test payment method ID for now
      // In production, you would need to create a payment method first using Stripe API
      const testPaymentMethodId = 'pm_card_visa';

      const response = await fetch(
        `${this.apiUrl}/confirm/${paymentIntentId}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            paymentMethodId: testPaymentMethodId,
          }),
        }
      );

      if (!response.ok) {
        const errorData = await response.json();
        console.error('Payment confirmation API error response:', errorData);
        throw new Error(
          JSON.stringify(errorData) || 'Failed to confirm payment'
        );
      }

      // Parse response
      const responseData = await response.json();
      console.log('Payment confirmation API response:', responseData);

      // Extract data from the response - handle both nested data formats
      let paymentConfirmation;

      if (responseData.data && responseData.data.data) {
        // Handle double-nested data structure
        paymentConfirmation = responseData.data.data;
        console.log('Extracted confirmation from double-nested data');
      } else if (responseData.data) {
        // Handle single-nested data structure
        paymentConfirmation = responseData.data;
        console.log('Extracted confirmation from single-nested data');
      } else {
        // Fallback to direct properties if no data nesting
        paymentConfirmation = responseData;
        console.log('Extracted confirmation from direct response');
      }

      console.log(
        'Payment confirmed successfully with status:',
        paymentConfirmation.status
      );

      return { success: true };
    } catch (error) {
      console.error('Error confirming payment:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown payment error',
      };
    }
  }

  /**
   * Get the payment status for a shipment
   */
  async getPaymentStatus(shipmentId: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('payments')
        .select('status')
        .eq('shipment_id', shipmentId)
        .single();

      if (error) throw error;
      return data?.status || 'unknown';
    } catch (error) {
      console.error('Error getting payment status:', error);
      return 'unknown';
    }
  }
}

export const paymentService = new PaymentService();
