'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { useAuth } from '@/hooks/useAuth';
import {
  Package,
  MapPin,
  DollarSign,
  Truck,
  Search,
  Filter,
  Clock,
  ArrowRight,
  Building2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/components/ui/toast';

export const dynamic = 'force-dynamic';

interface BrokerLoad {
  id: string;
  shipment_id: string;
  posted_by: string;
  visibility: string;
  load_status: string;
  bidding_enabled: boolean;
  suggested_carrier_payout: number | null;
  max_broker_commission: number | null;
  expires_at: string | null;
  created_at: string;
  shipment: {
    id: string;
    pickup_address: string;
    dropoff_address: string;
    vehicle_year: number;
    vehicle_make: string;
    vehicle_model: string;
    vehicle_type: string;
    vehicle_condition: string;
    distance: number;
    estimated_price: number;
    status: string;
    transport_type: string;
    is_operable: boolean;
  } | null;
}

export default function DriverBrokerLoadsPage() {
  const router = useRouter();
  const { profile } = useAuth();
  const [loads, setLoads] = useState<BrokerLoad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [searchTerm, setSearchTerm] = useState('');
  const [vehicleFilter, setVehicleFilter] = useState('all');
  const [applying, setApplying] = useState<string | null>(null);

  useEffect(() => {
    if (profile?.id) fetchLoads();
  }, [profile?.id]);

  const fetchLoads = async () => {
    try {
      const supabase = getSupabaseBrowserClient();

      // Get available loads from the load board visible to drivers (public visibility)
      const { data, error: fetchError } = await supabase
        .from('load_board')
        .select(`
          *,
          shipment:shipments(*)
        `)
        .eq('load_status', 'available')
        .in('visibility', ['public', 'network_only'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (fetchError) throw fetchError;
      setLoads(data || []);
    } catch (err: any) {
      console.error('Error fetching broker loads:', err);
      setError(err.message || 'Failed to load available broker shipments');
    } finally {
      setLoading(false);
    }
  };

  const handleApplyForLoad = async (load: BrokerLoad) => {
    if (!profile?.id || !load.shipment) return;
    setApplying(load.id);
    try {
      const supabase = getSupabaseBrowserClient();

      // Check if driver already applied
      const { data: existing } = await supabase
        .from('driver_applications')
        .select('id')
        .eq('shipment_id', load.shipment.id)
        .eq('driver_id', profile.id)
        .maybeSingle();

      if (existing) {
        toast('You have already applied for this load', 'error');
        return;
      }

      // Create driver application
      const { error: applyError } = await supabase
        .from('driver_applications')
        .insert({
          shipment_id: load.shipment.id,
          driver_id: profile.id,
          status: 'pending',
          proposed_price: load.suggested_carrier_payout || load.shipment.estimated_price,
          notes: `Applied via Broker Load Board (Load #${load.id.slice(0, 8)})`,
        });

      if (applyError) throw applyError;

      toast('Application submitted successfully! The broker will review your application.', 'success');
    } catch (err: any) {
      console.error('Error applying for load:', err);
      toast(err.message || 'Failed to apply', 'error');
    } finally {
      setApplying(null);
    }
  };

  const filteredLoads = loads.filter(load => {
    if (!load.shipment) return false;
    const matchesSearch = !searchTerm || 
      load.shipment.pickup_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.shipment.dropoff_address?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.shipment.vehicle_make?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      load.shipment.vehicle_model?.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesVehicle = vehicleFilter === 'all' || load.shipment.vehicle_type === vehicleFilter;
    return matchesSearch && matchesVehicle;
  });

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2">
            <Building2 className="h-5 w-5 text-teal-600" />
            <h1 className="text-lg font-semibold text-gray-900">Broker Load Board</h1>
          </div>
          <p className="text-sm text-gray-600 mt-1">Browse available shipments from brokers and carriers</p>
        </div>
        <Button variant="outline" onClick={fetchLoads} className="gap-2">
          <Clock className="h-4 w-4" />
          Refresh
        </Button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3 flex items-center gap-2">
          <AlertCircle className="h-4 w-4 text-red-500" />
          <p className="text-sm text-red-700">{error}</p>
        </div>
      )}

      {/* Filters */}
      <div className="bg-white rounded-md border border-gray-200 p-4 flex flex-col md:flex-row gap-3">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by location or vehicle..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-1 focus:ring-amber-500"
          />
        </div>
        <select
          value={vehicleFilter}
          onChange={(e) => setVehicleFilter(e.target.value)}
          className="px-3 py-2 border border-gray-300 rounded-md text-sm"
        >
          <option value="all">All Vehicle Types</option>
          <option value="sedan">Sedan</option>
          <option value="suv">SUV</option>
          <option value="truck">Truck</option>
          <option value="van">Van</option>
          <option value="motorcycle">Motorcycle</option>
        </select>
      </div>

      {/* Load Cards */}
      {filteredLoads.length === 0 ? (
        <div className="bg-white rounded-md border border-gray-200 p-8 text-center">
          <Package className="h-10 w-10 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-gray-900 mb-2">No Broker Loads Available</h3>
          <p className="text-sm text-gray-600">Check back later for new shipments from brokers.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredLoads.map((load) => {
            if (!load.shipment) return null;
            const s = load.shipment;
            const isExpiring = load.expires_at && new Date(load.expires_at).getTime() - Date.now() < 24 * 60 * 60 * 1000;

            return (
              <div key={load.id} className="bg-white rounded-md border border-gray-200 hover:border-teal-300 transition-colors overflow-hidden">
                <div className="p-4">
                  {/* Vehicle Info */}
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="font-semibold text-gray-900">
                        {s.vehicle_year} {s.vehicle_make} {s.vehicle_model}
                      </h3>
                      <p className="text-xs text-gray-500 capitalize">{s.vehicle_type} · {s.transport_type || 'open'} · {s.is_operable ? 'Operable' : 'Non-operable'}</p>
                    </div>
                    {load.suggested_carrier_payout && (
                      <div className="text-right">
                        <p className="text-lg font-bold text-green-600">${load.suggested_carrier_payout.toLocaleString()}</p>
                        <p className="text-xs text-gray-500">Carrier Payout</p>
                      </div>
                    )}
                  </div>

                  {/* Route */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-blue-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 truncate">{s.pickup_address || 'Pickup location'}</p>
                    </div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                      <p className="text-sm text-gray-700 truncate">{s.dropoff_address || 'Delivery location'}</p>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <Truck className="h-3.5 w-3.5" />
                      {s.distance?.toFixed(0) || '?'} mi
                    </span>
                    {isExpiring && (
                      <span className="flex items-center gap-1 text-amber-600 font-medium">
                        <Clock className="h-3.5 w-3.5" />
                        Expiring soon
                      </span>
                    )}
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-teal-50 text-teal-700 rounded-full font-medium">
                      <Building2 className="h-3 w-3" />
                      Broker
                    </span>
                  </div>
                </div>

                {/* Action */}
                <div className="px-4 py-3 bg-gray-50 border-t border-gray-200">
                  <Button
                    onClick={() => handleApplyForLoad(load)}
                    disabled={applying === load.id}
                    className="w-full bg-amber-500 hover:bg-amber-600 gap-2"
                    size="sm"
                  >
                    {applying === load.id ? (
                      <>
                        <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-white" />
                        Applying...
                      </>
                    ) : (
                      <>
                        Apply for This Load
                        <ArrowRight className="h-4 w-4" />
                      </>
                    )}
                  </Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
