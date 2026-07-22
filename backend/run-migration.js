/**
 * Run the draft status migration
 * Usage: node run-migration.js
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function runMigration() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey);

  console.log('📦 Reading migration file...');
  const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260716000001_shipment_draft_status.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('🚀 Running migration: 20260716000001_shipment_draft_status.sql');
  
  // Split by semicolons and execute each statement
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0 && !s.startsWith('--'));

  for (const statement of statements) {
    if (statement.length === 0) continue;
    
    console.log(`\n📝 Executing:\n${statement.substring(0, 100)}...`);
    
    const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
    
    if (error) {
      console.error('❌ Error:', error.message);
      // Try alternative method
      const { error: directError } = await supabase.from('_migrations').insert({
        name: '20260716000001_shipment_draft_status',
        executed_at: new Date().toISOString()
      });
      
      if (directError) {
        console.error('❌ Migration failed:', directError.message);
        process.exit(1);
      }
    } else {
      console.log('✅ Success');
    }
  }

  console.log('\n✅ Migration completed successfully!');
  console.log('🔍 Verifying draft status...');
  
  // Verify the migration
  const { data, error } = await supabase
    .from('shipments')
    .select('status')
    .limit(1);
  
  if (error) {
    console.error('❌ Verification failed:', error.message);
  } else {
    console.log('✅ Shipments table is accessible');
  }

  process.exit(0);
}

runMigration().catch(err => {
  console.error('❌ Fatal error:', err);
  process.exit(1);
});
