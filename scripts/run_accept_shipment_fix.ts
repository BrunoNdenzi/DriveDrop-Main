// Script to run the accept_shipment function fix migration
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import * as dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env file');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('🔧 Running accept_shipment function fix migration...\n');

    // Read the migration file
    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', 'fix_accept_shipment_function.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    console.log('📄 Migration SQL:');
    console.log('─'.repeat(80));
    console.log(migrationSQL);
    console.log('─'.repeat(80));
    console.log();

    // Execute the migration
    const { data, error } = await supabase.rpc('exec_sql', { sql: migrationSQL });

    if (error) {
      // Try direct query if rpc doesn't work
      console.log('⚠️  RPC method failed, trying direct query...\n');
      const { error: queryError } = await supabase.from('_').select('*').limit(0);
      
      // Use PostgreSQL REST API directly
      const response = await fetch(`${supabaseUrl}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
        },
        body: JSON.stringify({ sql: migrationSQL })
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
    }

    console.log('✅ Migration completed successfully!\n');
    console.log('📝 Changes made:');
    console.log('   • Updated accept_shipment() function to accept both "pending" and "assigned" statuses');
    console.log('   • Driver can now accept admin-assigned shipments');
    console.log('   • Function verifies the driver is assigned to the shipment before accepting');
    console.log('   • Better error message for unauthorized access\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.log('\n📋 Manual steps to fix:');
    console.log('1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/tgdewxxmfmbvvcelngeg');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy the SQL from: supabase/migrations/fix_accept_shipment_function.sql');
    console.log('4. Paste and run it in the SQL Editor');
    process.exit(1);
  }
}

runMigration();
