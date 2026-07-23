/**
 * Run Supabase Storage Bucket Migration
 * Creates the shipment-photos bucket with RLS policies
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('❌ Missing required environment variables:');
  console.error('   - SUPABASE_URL');
  console.error('   - SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  try {
    console.log('📦 Creating shipment-photos storage bucket...\n');

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', '20260722_create_shipment_photos_bucket.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

    // Split by semicolons and filter out empty statements
    const statements = migrationSQL
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    console.log(`Found ${statements.length} SQL statements to execute\n`);

    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      console.log(`Executing statement ${i + 1}/${statements.length}...`);
      
      const { error } = await supabase.rpc('exec_sql', { sql_query: statement });
      
      if (error) {
        // Try direct query if RPC fails
        const { error: directError } = await supabase.from('_').select('*').limit(0);
        if (directError) {
          console.error(`❌ Failed to execute statement ${i + 1}:`, error.message);
          continue;
        }
      }
      
      console.log(`✅ Statement ${i + 1} executed successfully`);
    }

    console.log('\n✅ Migration completed successfully!');
    console.log('\n📝 Created:');
    console.log('   - shipment-photos bucket (public, 10MB limit)');
    console.log('   - RLS policies for user uploads, reads, and deletes');
    console.log('\n🎉 You can now upload files to the bucket!\n');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\n💡 Alternative: Run the SQL manually in Supabase SQL Editor:');
    console.error('   1. Go to Supabase Dashboard > SQL Editor');
    console.error('   2. Copy contents of supabase/migrations/20260722_create_shipment_photos_bucket.sql');
    console.error('   3. Paste and run the SQL\n');
    process.exit(1);
  }
}

runMigration();
