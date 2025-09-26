const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = 'https://tgdewxxmfmbvvcelngeg.supabase.co';
// Using service role key to check database functions and triggers
const serviceRoleKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRnZGV3eHhtZm1idnZjZWxuZ2VnIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjIzODYyNiwiZXhwIjoyMDY3ODE0NjI2fQ.JDV5YXipLx4Ya_HotYspfI6MajAPgnFKJArUtpFpRU4';

const client = createClient(supabaseUrl, serviceRoleKey);

async function checkTriggers() {
  console.log('🔍 Checking database functions and triggers...\n');

  // Check if handle_new_user function exists
  try {
    const { data, error } = await client.rpc('sql', {
      query: `
        SELECT 
          proname as function_name,
          prosrc as function_body 
        FROM pg_proc 
        WHERE proname = 'handle_new_user';
      `
    });
    
    if (error) {
      console.log('❌ Error checking functions:', error.message);
    } else if (data && data.length > 0) {
      console.log('✅ handle_new_user function exists');
      console.log('📋 Function body preview:', data[0].function_body.substring(0, 200) + '...');
    } else {
      console.log('❌ handle_new_user function NOT found');
    }
  } catch (err) {
    console.log('❌ Function check error:', err.message);
  }

  // Check auth triggers
  try {
    const { data, error } = await client.rpc('sql', {
      query: `
        SELECT 
          tgname as trigger_name,
          tgrelid::regclass as table_name
        FROM pg_trigger 
        WHERE tgname LIKE '%user%' OR tgrelid::regclass::text = 'auth.users';
      `
    });
    
    if (error) {
      console.log('❌ Error checking triggers:', error.message);
    } else {
      console.log('✅ Auth triggers found:');
      data.forEach(trigger => {
        console.log(`  - ${trigger.trigger_name} on ${trigger.table_name}`);
      });
    }
  } catch (err) {
    console.log('❌ Trigger check error:', err.message);
  }
}

checkTriggers().catch(console.error);