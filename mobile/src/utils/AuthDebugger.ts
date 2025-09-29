/**
 * Authentication Debug Helper
 * Simple utility to test authentication status
 */
import { supabase } from '../lib/supabase';
import { getApiUrl } from '../utils/environment';

export class AuthDebugger {
  private static apiUrl = getApiUrl();

  static async checkAuthStatus() {
    try {
      console.log('🔍 Checking authentication status...');
      
      // Check Supabase session
      const { data: { session }, error } = await supabase.auth.getSession();
      
      console.log('📋 Supabase Auth Status:', {
        hasSession: !!session,
        hasUser: !!session?.user,
        userId: session?.user?.id,
        userEmail: session?.user?.email,
        userRole: session?.user?.role,
        tokenLength: session?.access_token?.length,
        tokenExpiry: session?.expires_at,
        error: error?.message
      });

      if (!session) {
        console.error('❌ No active session found');
        return { authenticated: false, error: 'No session' };
      }

      // Test API call to backend
      try {
        const response = await fetch(`${this.apiUrl}/api/v1/messages-v2/conversations`, {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          }
        });

        const result = await response.json();
        
        console.log('🌐 Backend API Test:', {
          status: response.status,
          success: result.success,
          error: result.error,
          url: `${this.apiUrl}/api/v1/messages-v2/conversations`
        });

        return {
          authenticated: response.status !== 401,
          backendResponse: result,
          status: response.status
        };
      } catch (apiError) {
        console.error('❌ API Test Error:', apiError);
        return {
          authenticated: false,
          error: 'API test failed',
          details: apiError
        };
      }

    } catch (error) {
      console.error('❌ Auth check failed:', error);
      return { authenticated: false, error: error };
    }
  }

  static async testBasicAuth() {
    console.log('🧪 Running basic auth test...');
    const result = await this.checkAuthStatus();
    
    if (result.authenticated) {
      console.log('✅ Authentication working properly');
    } else {
      console.log('❌ Authentication failed:', result.error);
    }
    
    return result;
  }
}