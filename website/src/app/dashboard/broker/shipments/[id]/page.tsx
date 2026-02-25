'use client';

import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import {
  ArrowLeft,
  Package,
  MapPin,
  User,
  Phone,
  Mail,
  Calendar,
  DollarSign,
  Truck,
  Clock,
  CheckCircle,
  XCircle,
  Edit,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

type ShipmentStatus = 'pending_quote' | 'quoted' | 'booked' | 'assigned' | 'in_transit' | 'delivered' | 'cancelled';

interface BrokerShipment {
  id: string;
  client_name: string;
  client_email: string;
  client_phone: string;
  pickup_address: string;
  pickup_city: string;
  pickup_state: string;
  pickup_zip: string;
  delivery_address: string;
  delivery_city: string;
  delivery_state: string;
  delivery_zip: string;
  vehicle_year: number;
  vehicle_make: string;
  vehicle_model: string;
  vehicle_type: string;
  vehicle_condition: string;
  distance_miles: number;
  estimated_price: number;
  status: ShipmentStatus;
  pickup_date: string | null;
  delivery_date: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function BrokerShipmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const shipmentId = params.id as string;
  const [shipment, setShipment] = useState<BrokerShipment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchShipment();
  }, [shipmentId]);

  const fetchShipment = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push('/login'); return; }

      const { data, error: fetchError } = await supabase
        .from('broker_shipments')
        .select('*')
        .eq('id', shipmentId)
        .eq('broker_id', user.id)
        .single();

      if (fetchError) throw fetchError;
      setShipment(data);
    } catch (err: any) {
      console.error('Error fetching shipment:', err);
      setError(err.message || 'Shipment not found');
    } finally {
      setLoading(false);
    }
  };

  const handleStatusUpdate = async (newStatus: ShipmentStatus) => {
    if (!shipment) return;
    setUpdating(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error: updateError } = await supabase
        .from('broker_shipments')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq('id', shipment.id);

      if (updateError) throw updateError;
      setShipment({ ...shipment, status: newStatus });
    } catch (err: any) {
      setError(err.message || 'Failed to update status');
    } finally {
      setUpdating(false);
    }
  };

  const getStatusConfig = (status: ShipmentStatus) => {
    const config: Record<ShipmentStatus, { color: string; icon: any; label: string }> = {
      pending_quote: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', icon: Clock, label: 'Pending Quote' },
      quoted: { color: 'bg-blue-100 text-blue-800 border-blue-200', icon: Package, label: 'Quoted' },
      booked: { color: 'bg-purple-100 text-purple-800 border-purple-200', icon: CheckCircle, label: 'Booked' },
      assigned: { color: 'bg-indigo-100 text-indigo-800 border-indigo-200', icon: Truck, label: 'Assigned' },
      in_transit: { color: 'bg-orange-100 text-orange-800 border-orange-200', icon: Truck, label: 'In Transit' },
      delivered: { color: 'bg-green-100 text-green-800 border-green-200', icon: CheckCircle, label: 'Delivered' },
      cancelled: { color: 'bg-red-100 text-red-800 border-red-200', icon: XCircle, label: 'Cancelled' },
    };
    return config[status];
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500"></div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="max-w-4xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
          <AlertCircle className="h-10 w-10 text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-semibold text-red-900">{error || 'Shipment not found'}</h3>
          <Button onClick={() => router.push('/dashboard/broker/shipments')} className="mt-4" variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" /> Back to Shipments
          </Button>
        </div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(shipment.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Button variant="outline" size="sm" onClick={() => router.push('/dashboard/broker/shipments')}>
            <ArrowLeft className="h-4 w-4 mr-1" /> Back
          </Button>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">
              {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
            </h1>
            <p className="text-xs text-gray-500">Shipment ID: {shipment.id.slice(0, 8)}...</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusConfig.color}`}>
            <StatusIcon className="h-3.5 w-3.5" />
            {statusConfig.label}
          </span>
          <Button size="sm" onClick={() => router.push(`/dashboard/broker/shipments/${shipment.id}/edit`)}>
            <Edit className="h-4 w-4 mr-1" /> Edit
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Main Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Route */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Route Information</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-green-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-xs text-gray-500">Pickup</p>
                  <p className="text-sm font-medium text-gray-900">{shipment.pickup_address}</p>
                  <p className="text-xs text-gray-500">{shipment.pickup_city}, {shipment.pickup_state} {shipment.pickup_zip}</p>
                  {shipment.pickup_date && <p className="text-xs text-gray-500 mt-1"><Calendar className="h-3 w-3 inline mr-1" />{new Date(shipment.pickup_date).toLocaleDateString()}</p>}
                </div>
              </div>
              <div className="flex items-start gap-3">
                <div className="w-3 h-3 bg-red-500 rounded-full mt-1.5"></div>
                <div>
                  <p className="text-xs text-gray-500">Delivery</p>
                  <p className="text-sm font-medium text-gray-900">{shipment.delivery_address}</p>
                  <p className="text-xs text-gray-500">{shipment.delivery_city}, {shipment.delivery_state} {shipment.delivery_zip}</p>
                  {shipment.delivery_date && <p className="text-xs text-gray-500 mt-1"><Calendar className="h-3 w-3 inline mr-1" />{new Date(shipment.delivery_date).toLocaleDateString()}</p>}
                </div>
              </div>
              <div className="text-sm text-gray-600 pt-2 border-t">
                <MapPin className="h-4 w-4 inline mr-1" /> {shipment.distance_miles} miles
              </div>
            </div>
          </div>

          {/* Vehicle Info */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Vehicle Information</h2>
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div><span className="text-gray-500">Vehicle</span><p className="font-medium">{shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}</p></div>
              <div><span className="text-gray-500">Type</span><p className="font-medium capitalize">{shipment.vehicle_type}</p></div>
              <div><span className="text-gray-500">Condition</span><p className="font-medium capitalize">{shipment.vehicle_condition}</p></div>
            </div>
          </div>

          {/* Notes */}
          {shipment.notes && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Notes</h2>
              <p className="text-sm text-gray-700">{shipment.notes}</p>
            </div>
          )}
        </div>

        {/* Sidebar */}
        <div className="space-y-4">
          {/* Client Info */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Client Information</h2>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><User className="h-4 w-4 text-gray-400" /><span>{shipment.client_name}</span></div>
              <div className="flex items-center gap-2"><Mail className="h-4 w-4 text-gray-400" /><a href={`mailto:${shipment.client_email}`} className="text-teal-600 hover:text-teal-700">{shipment.client_email}</a></div>
              {shipment.client_phone && <div className="flex items-center gap-2"><Phone className="h-4 w-4 text-gray-400" /><a href={`tel:${shipment.client_phone}`} className="text-teal-600">{shipment.client_phone}</a></div>}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Pricing</h2>
            <div className="text-center py-3">
              <p className="text-2xl font-bold text-green-600">${shipment.estimated_price.toLocaleString()}</p>
              <p className="text-xs text-gray-500">Estimated Price</p>
            </div>
          </div>

          {/* Status Actions */}
          {shipment.status !== 'delivered' && shipment.status !== 'cancelled' && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <h2 className="text-sm font-semibold text-gray-900 mb-3">Update Status</h2>
              <div className="space-y-2">
                {shipment.status === 'pending_quote' && (
                  <Button size="sm" className="w-full bg-blue-500 hover:bg-blue-600" onClick={() => handleStatusUpdate('quoted')} disabled={updating}>
                    Mark as Quoted
                  </Button>
                )}
                {shipment.status === 'quoted' && (
                  <Button size="sm" className="w-full bg-purple-500 hover:bg-purple-600" onClick={() => handleStatusUpdate('booked')} disabled={updating}>
                    Mark as Booked
                  </Button>
                )}
                {shipment.status === 'booked' && (
                  <Button size="sm" className="w-full bg-indigo-500 hover:bg-indigo-600" onClick={() => handleStatusUpdate('assigned')} disabled={updating}>
                    Assign to Carrier
                  </Button>
                )}
                {shipment.status === 'assigned' && (
                  <Button size="sm" className="w-full bg-orange-500 hover:bg-orange-600" onClick={() => handleStatusUpdate('in_transit')} disabled={updating}>
                    Mark In Transit
                  </Button>
                )}
                {shipment.status === 'in_transit' && (
                  <Button size="sm" className="w-full bg-green-500 hover:bg-green-600" onClick={() => handleStatusUpdate('delivered')} disabled={updating}>
                    Mark Delivered
                  </Button>
                )}
                <Button size="sm" variant="outline" className="w-full text-red-600 border-red-300 hover:bg-red-50" onClick={() => handleStatusUpdate('cancelled')} disabled={updating}>
                  Cancel Shipment
                </Button>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <h2 className="text-sm font-semibold text-gray-900 mb-3">Timeline</h2>
            <div className="space-y-2 text-xs text-gray-600">
              <div className="flex items-center gap-2"><Calendar className="h-3 w-3" /> Created: {new Date(shipment.created_at).toLocaleString()}</div>
              <div className="flex items-center gap-2"><Clock className="h-3 w-3" /> Updated: {new Date(shipment.updated_at).toLocaleString()}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
