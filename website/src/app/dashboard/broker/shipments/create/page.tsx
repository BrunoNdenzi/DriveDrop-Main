'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { ArrowLeft, Save, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import ShipmentForm from '@/components/shipment/ShipmentForm';
import Link from 'next/link';

export default function CreateBrokerShipmentPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (shipmentData: any) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.push('/login');
        return;
      }

      // Get broker profile to get commission rate
      const { data: brokerProfile } = await supabase
        .from('broker_profiles')
        .select('default_commission_rate')
        .eq('user_id', user.id)
        .single();

      const commissionRate = brokerProfile?.default_commission_rate || 15;

      // Calculate broker commission and platform fee
      const totalPrice = shipmentData.estimated_price;
      const brokerCommission = (totalPrice * commissionRate) / 100;
      const platformFee = (totalPrice * 10) / 100; // 10% platform fee

      // Create broker shipment
      const { data: newShipment, error: shipmentError } = await supabase
        .from('broker_shipments')
        .insert({
          broker_id: user.id,
          client_name: shipmentData.clientName || 'N/A',
          client_email: shipmentData.clientEmail || '',
          client_phone: shipmentData.clientPhone || '',
          
          pickup_address: shipmentData.pickup.address,
          pickup_city: shipmentData.pickup.city,
          pickup_state: shipmentData.pickup.state,
          pickup_zip: shipmentData.pickup.zipCode,
          pickup_latitude: shipmentData.pickup.lat,
          pickup_longitude: shipmentData.pickup.lng,
          
          delivery_address: shipmentData.delivery.address,
          delivery_city: shipmentData.delivery.city,
          delivery_state: shipmentData.delivery.state,
          delivery_zip: shipmentData.delivery.zipCode,
          delivery_latitude: shipmentData.delivery.lat,
          delivery_longitude: shipmentData.delivery.lng,
          
          vehicle_year: shipmentData.vehicle.year,
          vehicle_make: shipmentData.vehicle.make,
          vehicle_model: shipmentData.vehicle.model,
          vehicle_type: shipmentData.vehicle.type,
          vehicle_condition: shipmentData.vehicle.condition,
          vehicle_vin: shipmentData.vehicle.vin || null,
          
          distance_miles: shipmentData.distance,
          estimated_price: totalPrice,
          broker_commission: brokerCommission,
          platform_fee: platformFee,
          
          pickup_date: shipmentData.pickupDate || null,
          delivery_date: shipmentData.deliveryDate || null,
          
          transport_type: shipmentData.transportType || 'open',
          is_operable: shipmentData.isOperable !== false,
          
          notes: shipmentData.notes || null,
          status: 'pending_quote',
        })
        .select()
        .single();

      if (shipmentError) throw shipmentError;

      // Success! Redirect to shipments list
      router.push('/dashboard/broker/shipments');
    } catch (err: any) {
      console.error('Error creating shipment:', err);
      setError(err.message || 'Failed to create shipment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/dashboard/broker/shipments">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Shipments
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Create Shipment</h1>
            <p className="text-gray-600 mt-1">Create a new shipment for your client</p>
          </div>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-medium text-red-800">Error creating shipment</h3>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
        <h3 className="text-sm font-semibold text-blue-900 mb-2">📋 Broker Shipment Information</h3>
        <ul className="text-sm text-blue-800 space-y-1">
          <li>• You're creating this shipment on behalf of your client</li>
          <li>• Your commission will be calculated automatically based on your rate</li>
          <li>• The shipment will appear on the load board for carriers to bid on</li>
          <li>• You can track and manage this shipment from the "My Shipments" page</li>
        </ul>
      </div>

      {/* Shipment Form */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <ShipmentForm 
          onSubmit={handleSubmit} 
          isSubmitting={isSubmitting}
          showClientFields={true}
        />
      </div>
    </div>
  );
}
