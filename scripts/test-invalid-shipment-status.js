// test-invalid-shipment-status.js
// Script to check for "picked_up" status in shipments and shipment_status_history tables

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Error: SUPABASE_URL and SUPABASE_SERVICE_KEY must be set in .env file');
  process.exit(1);
}

// Create Supabase client with service key for admin access
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function checkForPickedUpStatus() {
  try {
    console.log('Checking for "picked_up" status in shipments table...');
    const { data: shipments, error: shipmentsError } = await supabase
      .from('shipments')
      .select('id, status, client_id, driver_id, created_at')
      .eq('status', 'picked_up');

    if (shipmentsError) {
      console.error('Error querying shipments:', shipmentsError);
    } else {
      console.log(`Found ${shipments?.length || 0} shipments with status "picked_up":`);
      if (shipments && shipments.length > 0) {
        shipments.forEach(s => console.log(`- Shipment ID: ${s.id}, Created: ${s.created_at}`));
      }
    }

    console.log('\nChecking for "picked_up" status in shipment_status_history table...');
    const { data: history, error: historyError } = await supabase
      .from('shipment_status_history')
      .select('id, shipment_id, status, changed_at')
      .eq('status', 'picked_up');

    if (historyError) {
      console.error('Error querying shipment_status_history:', historyError);
    } else {
      console.log(`Found ${history?.length || 0} history records with status "picked_up":`);
      if (history && history.length > 0) {
        history.forEach(h => console.log(`- History ID: ${h.id}, Shipment ID: ${h.shipment_id}, Changed: ${h.changed_at}`));
      }
    }

    // List all valid shipment statuses
    console.log('\nChecking the current valid shipment statuses in the enum...');
    const { data: statuses, error: statusesError } = await supabase.rpc('get_enum_values', { enum_name: 'shipment_status' });
    
    if (statusesError) {
      console.error('Error fetching enum values:', statusesError);
    } else {
      console.log('Valid shipment statuses:', statuses);
    }
    
  } catch (error) {
    console.error('Unexpected error:', error);
  }
}

// Function to update the invalid status records
async function updateInvalidStatusRecords() {
  try {
    console.log('Updating shipments with "picked_up" status to "in_transit"...');
    const { data: shipmentUpdateData, error: shipmentUpdateError } = await supabase
      .from('shipments')
      .update({ status: 'in_transit', updated_at: new Date().toISOString() })
      .eq('status', 'picked_up');
    
    if (shipmentUpdateError) {
      console.error('Error updating shipments:', shipmentUpdateError);
    } else {
      console.log('Shipments update successful');
    }
    
    console.log('\nUpdating shipment_status_history with "picked_up" status to "in_transit"...');
    const { data: historyUpdateData, error: historyUpdateError } = await supabase
      .from('shipment_status_history')
      .update({ status: 'in_transit' })
      .eq('status', 'picked_up');
    
    if (historyUpdateError) {
      console.error('Error updating shipment_status_history:', historyUpdateError);
    } else {
      console.log('History update successful');
    }
    
    console.log('\nVerifying updates...');
    await checkForPickedUpStatus();
  } catch (error) {
    console.error('Unexpected error during update:', error);
  }
}

async function main() {
  await checkForPickedUpStatus();
  
  const readline = require('readline').createInterface({
    input: process.stdin,
    output: process.stdout
  });
  
  readline.question('\nDo you want to update all "picked_up" status records to "in_transit"? (yes/no): ', async (answer) => {
    if (answer.toLowerCase() === 'yes') {
      await updateInvalidStatusRecords();
    } else {
      console.log('No updates performed.');
    }
    
    readline.close();
    process.exit(0);
  });
}

main();
