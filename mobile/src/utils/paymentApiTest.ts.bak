/**
 * Payment API Diagnostic Utility
 * This utility helps test and diagnose issues with the payment API
 */

import NetInfo from '@react-native-community/netinfo';
import { getApiUrl } from '../utils/environment';
import { auth } from '../lib/supabase';

type PaymentApiTestResult = {
  success: boolean;
  message: string;
  details?: any;
  timestamp: string;
};

/**
 * Helper function to make authenticated requests
 */
async function fetchWithAuthHelper(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  // Get the user's JWT token
  const {
    data: { session },
  } = await auth.getSession();

  if (!session) {
    throw new Error('No authenticated session found');
  }

  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session.access_token}`,
    ...options.headers,
  };

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Comprehensive payment API test utility
 * Tests network connectivity, API access, and Stripe services
 */
export const paymentApiTest = {
  /**
   * Check basic network connectivity
   */
  async checkNetworkConnectivity(): Promise<PaymentApiTestResult> {
    try {
      const netInfo = await NetInfo.fetch();

      if (!netInfo.isConnected) {
        return {
          success: false,
          message: 'Device is not connected to the internet',
          details: netInfo,
          timestamp: new Date().toISOString(),
        };
      }

      return {
        success: true,
        message: 'Device has internet connectivity',
        details: {
          type: netInfo.type,
          isConnected: netInfo.isConnected,
          isInternetReachable: netInfo.isInternetReachable,
        },
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to check network connectivity',
        details: { error },
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Check API server connectivity
   */
  async checkApiConnectivity(): Promise<PaymentApiTestResult> {
    try {
      const apiUrl = getApiUrl();

      if (!apiUrl) {
        return {
          success: false,
          message: 'API URL is not configured',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to connect to the API health endpoint
      const response = await fetch(`${apiUrl}/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        return {
          success: false,
          message: `API server returned error: ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'API server is reachable',
        details: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to connect to API server',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Check authentication and payment API access
   */
  async checkPaymentApiAccess(): Promise<PaymentApiTestResult> {
    try {
      const apiUrl = getApiUrl();

      if (!apiUrl) {
        return {
          success: false,
          message: 'API URL is not configured',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to connect to a protected payments endpoint
      const response = await fetchWithAuthHelper(
        `${apiUrl}/api/v1/payments/status`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: 'Could not parse error response' };
        }

        return {
          success: false,
          message: `Payment API access failed: ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            data: errorData,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Payment API is accessible',
        details: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to access payment API',
        details: {
          error: error instanceof Error ? error.message : String(error),
          stack: error instanceof Error ? error.stack : undefined,
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Check Stripe service availability
   */
  async checkStripeServiceStatus(): Promise<PaymentApiTestResult> {
    try {
      const apiUrl = getApiUrl();

      if (!apiUrl) {
        return {
          success: false,
          message: 'API URL is not configured',
          timestamp: new Date().toISOString(),
        };
      }

      // Try to connect to a dedicated Stripe connectivity check endpoint
      const response = await fetchWithAuthHelper(
        `${apiUrl}/api/v1/payments/stripe-status`,
        {
          method: 'GET',
        }
      );

      if (!response.ok) {
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { error: 'Could not parse error response' };
        }

        return {
          success: false,
          message: `Stripe service check failed: ${response.status}`,
          details: {
            status: response.status,
            statusText: response.statusText,
            data: errorData,
          },
          timestamp: new Date().toISOString(),
        };
      }

      const data = await response.json();

      return {
        success: true,
        message: 'Stripe service is available',
        details: data,
        timestamp: new Date().toISOString(),
      };
    } catch (error) {
      return {
        success: false,
        message: 'Failed to check Stripe service',
        details: {
          error: error instanceof Error ? error.message : String(error),
        },
        timestamp: new Date().toISOString(),
      };
    }
  },

  /**
   * Run all payment diagnostic tests
   */
  async runAllTests(): Promise<{
    networkTest: PaymentApiTestResult;
    apiTest: PaymentApiTestResult;
    paymentApiTest: PaymentApiTestResult;
    stripeTest: PaymentApiTestResult;
    summary: string;
  }> {
    const networkTest = await this.checkNetworkConnectivity();
    const apiTest = await this.checkApiConnectivity();
    const paymentApiTest = await this.checkPaymentApiAccess();
    const stripeTest = await this.checkStripeServiceStatus();

    // Generate summary
    const allTests = [networkTest, apiTest, paymentApiTest, stripeTest];
    const passedCount = allTests.filter(test => test.success).length;

    let summary = `Payment API Diagnostic Summary: ${passedCount}/${allTests.length} tests passed.\n`;

    if (!networkTest.success) {
      summary += '❌ Network connectivity issue detected.\n';
    }

    if (networkTest.success && !apiTest.success) {
      summary += '❌ API server unreachable despite network connectivity.\n';
    }

    if (apiTest.success && !paymentApiTest.success) {
      summary +=
        '❌ Payment API access failed despite API server being reachable (possible auth issue).\n';
    }

    if (paymentApiTest.success && !stripeTest.success) {
      summary +=
        '❌ Stripe service unavailable despite payment API being accessible.\n';
    }

    if (allTests.every(test => test.success)) {
      summary += '✅ All payment services are operational.\n';
    }

    return {
      networkTest,
      apiTest,
      paymentApiTest,
      stripeTest,
      summary,
    };
  },
};
