/**
 * Script to test Supabase integration
 */
const { validateSupabaseIntegration } = require('../dist/utils/supabase-test');

async function main() {
  try {
    console.log('🚀 Running Supabase integration tests...\n');
    await validateSupabaseIntegration();
  } catch (error) {
    console.error('❌ Test runner error:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}
