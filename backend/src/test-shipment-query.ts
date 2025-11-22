import { supabase } from './lib/supabase';
import { logger } from './utils/logger';

async function testShipmentQuery() {
  const shipmentId = '14609f46-f9c2-4023-bfe6-e0c4ee47be38'; // Use the shipment ID from your test
  
  logger.info('Testing shipment query...');
  
  // Test 1: Basic shipment query
  const { data: basicShipment, error: basicError } = await supabase
    .from('shipments')
    .select('*')
    .eq('id', shipmentId)
    .single();
  
  logger.info('Basic shipment query result:', { 
    success: !basicError, 
    hasData: !!basicShipment,
    clientId: basicShipment?.client_id,
    error: basicError 
  });
  
  // Test 2: Query with client join
  const { data: shipmentWithClient, error: joinError } = await supabase
    .from('shipments')
    .select('*, client:profiles!client_id(first_name, last_name, email)')
    .eq('id', shipmentId)
    .single();
  
  logger.info('Shipment with client join result:', { 
    success: !joinError, 
    hasData: !!shipmentWithClient,
    hasClient: !!shipmentWithClient?.client,
    clientEmail: shipmentWithClient?.client?.email,
    error: joinError 
  });
  
  // Test 3: Direct profiles query
  if (basicShipment?.client_id) {
    const { data: client, error: clientError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', basicShipment.client_id)
      .single();
    
    logger.info('Direct client query result:', { 
      success: !clientError, 
      hasData: !!client,
      email: client?.email,
      firstName: client?.first_name,
      error: clientError 
    });
  }
  
  process.exit(0);
}

testShipmentQuery().catch(error => {
  logger.error('Test failed:', error);
  process.exit(1);
});
