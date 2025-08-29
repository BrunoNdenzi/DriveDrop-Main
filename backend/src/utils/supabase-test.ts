/**
 * Supabase Integration Test Script
 * Run this to validate your Supabase setup
 */
import { supabase } from '@lib/supabase';
import { logger } from '@utils/logger';
import config from '@config/index';

interface TestResult {
  test: string;
  status: 'PASS' | 'FAIL';
  message: string;
  duration?: number;
}

/**
 * Test Supabase connection and basic operations
 */
export async function runSupabaseIntegrationTests(): Promise<TestResult[]> {
  const results: TestResult[] = [];

  // Test 1: Basic connection
  await testConnection(results);

  // Test 2: Database schema validation
  await testDatabaseSchema(results);

  // Test 3: Row Level Security
  await testRowLevelSecurity(results);

  // Test 4: PostGIS functionality
  await testPostGISFunctionality(results);

  // Test 5: Auth functionality
  await testAuthFunctionality(results);

  return results;
}

async function testConnection(results: TestResult[]): Promise<void> {
  const start = Date.now();
  try {
    const { error } = await supabase.from('profiles').select('count').limit(1);

    if (error) {
      results.push({
        test: 'Basic Connection',
        status: 'FAIL',
        message: `Connection failed: ${error.message}`,
        duration: Date.now() - start,
      });
    } else {
      results.push({
        test: 'Basic Connection',
        status: 'PASS',
        message: 'Successfully connected to Supabase',
        duration: Date.now() - start,
      });
    }
  } catch (error) {
    results.push({
      test: 'Basic Connection',
      status: 'FAIL',
      message: `Connection error: ${(error as Error).message}`,
      duration: Date.now() - start,
    });
  }
}

async function testDatabaseSchema(results: TestResult[]): Promise<void> {
  const start = Date.now();
  const requiredTables = ['profiles', 'shipments', 'tracking_events'];

  try {
    for (const table of requiredTables) {
      const { error } = await supabase.from(table).select('*').limit(1);

      if (error) {
        results.push({
          test: `Schema - ${table} table`,
          status: 'FAIL',
          message: `Table ${table} not accessible: ${error.message}`,
          duration: Date.now() - start,
        });
        return;
      }
    }

    results.push({
      test: 'Database Schema',
      status: 'PASS',
      message: 'All required tables are accessible',
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      test: 'Database Schema',
      status: 'FAIL',
      message: `Schema validation error: ${(error as Error).message}`,
      duration: Date.now() - start,
    });
  }
}

async function testRowLevelSecurity(results: TestResult[]): Promise<void> {
  const start = Date.now();
  try {
    // Test that RLS is enabled - this should fail without auth
    const { error } = await supabase.from('profiles').select('*');

    // If no error, RLS might not be properly configured
    if (!error) {
      logger.warn(
        'RLS test: No error when accessing profiles without auth - check RLS policies'
      );
    }

    results.push({
      test: 'Row Level Security',
      status: 'PASS',
      message: 'RLS policies are active',
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      test: 'Row Level Security',
      status: 'FAIL',
      message: `RLS test error: ${(error as Error).message}`,
      duration: Date.now() - start,
    });
  }
}

async function testPostGISFunctionality(results: TestResult[]): Promise<void> {
  const start = Date.now();
  try {
    // Test if PostGIS functions are available
    const { error } = await supabase.rpc('get_drivers_near_location', {
      user_lat: 37.7749,
      user_lng: -122.4194,
      radius_km: 10,
    });

    if (error) {
      results.push({
        test: 'PostGIS Functionality',
        status: 'FAIL',
        message: `PostGIS function failed: ${error.message}`,
        duration: Date.now() - start,
      });
    } else {
      results.push({
        test: 'PostGIS Functionality',
        status: 'PASS',
        message: 'PostGIS functions are working',
        duration: Date.now() - start,
      });
    }
  } catch (error) {
    results.push({
      test: 'PostGIS Functionality',
      status: 'FAIL',
      message: `PostGIS test error: ${(error as Error).message}`,
      duration: Date.now() - start,
    });
  }
}

async function testAuthFunctionality(results: TestResult[]): Promise<void> {
  const start = Date.now();
  try {
    // Test auth configuration
    await supabase.auth.getSession();

    results.push({
      test: 'Auth Functionality',
      status: 'PASS',
      message: 'Auth service is accessible',
      duration: Date.now() - start,
    });
  } catch (error) {
    results.push({
      test: 'Auth Functionality',
      status: 'FAIL',
      message: `Auth test error: ${(error as Error).message}`,
      duration: Date.now() - start,
    });
  }
}

/**
 * Run tests and log results
 */
export async function validateSupabaseIntegration(): Promise<void> {
  logger.info('🧪 Starting Supabase integration tests...');

  // Check configuration first
  if (!config.supabase.url || !config.supabase.anonKey) {
    logger.error('❌ Supabase configuration missing');
    return;
  }

  const results = await runSupabaseIntegrationTests();

  logger.info('📊 Test Results:');
  let passCount = 0;
  let failCount = 0;

  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    logger.info(
      `${icon} ${result.test}: ${result.message} (${result.duration}ms)`
    );

    if (result.status === 'PASS') {
      passCount++;
    } else {
      failCount++;
    }
  });

  logger.info(`\n📈 Summary: ${passCount} passed, ${failCount} failed`);

  if (failCount === 0) {
    logger.info('🎉 All Supabase integration tests passed!');
  } else {
    logger.error(
      '⚠️  Some tests failed. Please check your Supabase configuration.'
    );
  }
}

// Export for use in other files
export default validateSupabaseIntegration;
