/**
 * Debug helper to test modules loading correctly
 */

import { ShipmentApiService } from './shipmentApiService';
import { PaymentStatusService } from './paymentStatusService';

export const moduleDebugHelper = {
  testApiServiceLoading() {
    const isAvailable = typeof ShipmentApiService === 'object' && 
                       ShipmentApiService !== null && 
                       'updateShipment' in ShipmentApiService && 
                       typeof (ShipmentApiService as any).updateShipment === 'function';
    
    console.log('ShipmentApiService module test - updateShipment available:', isAvailable);
    return isAvailable;
  },
  
  testPaymentStatusLoading() {
    const isAvailable = typeof PaymentStatusService === 'object' && 
                       PaymentStatusService !== null && 
                       'updatePaymentStatus' in PaymentStatusService && 
                       typeof (PaymentStatusService as any).updatePaymentStatus === 'function';
    
    console.log('PaymentStatusService module test - updatePaymentStatus available:', isAvailable);
    return isAvailable;
  },
  
  getModuleStatus() {
    return {
      shipmentApiAvailable: this.testApiServiceLoading(),
      paymentStatusAvailable: this.testPaymentStatusLoading()
    };
  }
};