/**
 * Module test file - checks if critical modules can be loaded correctly
 */
import * as React from 'react';
import { View, Text, Button } from 'react-native';
import { ShipmentApiService } from './services/shipmentApiService';
import { PaymentStatusService } from './services/paymentStatusService';

export default function ModuleTest() {
  const [testResults, setTestResults] = React.useState<{
    shipmentApiLoaded: boolean;
    paymentStatusLoaded: boolean;
    error: string | null;
  }>({
    shipmentApiLoaded: false,
    paymentStatusLoaded: false,
    error: null
  });

  const runTests = () => {
    try {
      // Test ShipmentApiService
      const shipmentApiLoaded = typeof ShipmentApiService === 'function' || 
                               (typeof ShipmentApiService === 'object' && 
                                ShipmentApiService !== null && 
                                'updateShipment' in ShipmentApiService && 
                                typeof (ShipmentApiService as any).updateShipment === 'function');
      
      // Test PaymentStatusService
      const paymentStatusLoaded = typeof PaymentStatusService === 'function' || 
                                 (typeof PaymentStatusService === 'object' && 
                                  PaymentStatusService !== null && 
                                  'updatePaymentStatus' in PaymentStatusService && 
                                  typeof (PaymentStatusService as any).updatePaymentStatus === 'function');
      
      setTestResults({
        shipmentApiLoaded,
        paymentStatusLoaded,
        error: null
      });

      console.log('Module test results:', {
        shipmentApiLoaded,
        paymentStatusLoaded
      });
    } catch (error) {
      setTestResults({
        shipmentApiLoaded: false,
        paymentStatusLoaded: false,
        error: error instanceof Error ? error.message : String(error)
      });
      console.error('Error during module tests:', error);
    }
  };

  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 20 }}>
      <Text style={{ fontSize: 20, fontWeight: 'bold', marginBottom: 20 }}>
        Module Loading Test
      </Text>

      <Button title="Run Tests" onPress={runTests} />

      <View style={{ marginTop: 20, alignItems: 'flex-start', width: '100%' }}>
        <Text>ShipmentApiService loaded: {testResults.shipmentApiLoaded ? '✅' : '❌'}</Text>
        <Text>PaymentStatusService loaded: {testResults.paymentStatusLoaded ? '✅' : '❌'}</Text>
        
        {testResults.error && (
          <Text style={{ color: 'red', marginTop: 10 }}>
            Error: {testResults.error}
          </Text>
        )}
      </View>
    </View>
  );
}