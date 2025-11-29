'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { brokerProfileService, brokerAssignmentService } from '@/services/brokerService';
import type { BrokerProfile, BrokerAssignmentWithDetails } from '@/types/broker';
import { 
  MapPin, 
  Truck, 
  Navigation,
  Clock,
  Phone,
  User,
  Package,
  RefreshCw,
  Maximize2,
  Filter,
  Search,
  X,
  ChevronRight,
  AlertCircle
} from 'lucide-react';
import { Button } from '@/components/ui/button';

export const dynamic = 'force-dynamic';

type ActiveShipment = {
  id: string;
  assignment: BrokerAssignmentWithDetails;
  currentLat?: number;
  currentLng?: number;
  lastUpdate?: Date;
  estimatedArrival?: Date;
  status: 'in_transit' | 'at_pickup' | 'at_delivery';
};

export default function BrokerTrackingPage() {
  const router = useRouter();
  const mapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [activeShipments, setActiveShipments] = useState<ActiveShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ActiveShipment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_transit' | 'at_pickup' | 'at_delivery'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  useEffect(() => {
    loadData();
    initializeMap();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(() => {
      if (autoRefresh) {
        loadData();
      }
    }, 30000);

    return () => clearInterval(interval);
  }, [autoRefresh]);

  const loadData = async () => {
    try {
      const supabase = getSupabaseBrowserClient();
      
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) {
        router.push('/login');
        return;
      }

      const brokerProfile = await brokerProfileService.getByProfileId(user.id);
      setBroker(brokerProfile);

      // Get active assignments
      const assignments = await brokerAssignmentService.getByBrokerId(brokerProfile.id);
      const active = assignments.filter(a => 
        a.assignment_status === 'in_progress' || a.assignment_status === 'accepted'
      );

      // Transform to active shipments with location data
      const shipments: ActiveShipment[] = active.map(assignment => ({
        id: assignment.id,
        assignment,
        currentLat: undefined, // Would need to fetch from shipment
        currentLng: undefined,
        lastUpdate: undefined,
        status: assignment.assignment_status === 'in_progress' ? 'in_transit' : 'at_pickup'
      }));

      setActiveShipments(shipments);
      setLastRefresh(new Date());
      
      // Update map markers
      updateMapMarkers(shipments);
    } catch (err: any) {
      console.error('Error loading tracking data:', err);
    } finally {
      setLoading(false);
    }
  };

  const initializeMap = () => {
    // Initialize map (placeholder for actual map library like Mapbox/Google Maps)
    console.log('Map initialized');
  };

  const updateMapMarkers = (shipments: ActiveShipment[]) => {
    // Update markers on the map
    // This would use actual map library API
    console.log('Updating markers for', shipments.length, 'shipments');
  };

  const getFilteredShipments = () => {
    let filtered = [...activeShipments];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.id.toLowerCase().includes(term) ||
        s.assignment.carrier?.full_name?.toLowerCase().includes(term)
      );
    }

    return filtered;
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'in_transit':
        return 'text-blue-600 bg-blue-50 border-blue-200';
      case 'at_pickup':
        return 'text-yellow-600 bg-yellow-50 border-yellow-200';
      case 'at_delivery':
        return 'text-green-600 bg-green-50 border-green-200';
      default:
        return 'text-gray-600 bg-gray-50 border-gray-200';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'in_transit':
        return 'In Transit';
      case 'at_pickup':
        return 'At Pickup';
      case 'at_delivery':
        return 'At Delivery';
      default:
        return status;
    }
  };

  const filteredShipments = getFilteredShipments();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 rounded-2xl p-8 text-white">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-3xl font-bold mb-2">Live Tracking</h1>
            <p className="text-blue-100">
              Real-time monitoring of {activeShipments.length} active shipment{activeShipments.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => loadData()}
              className="bg-white text-blue-600 hover:bg-blue-50"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
            <Button
              onClick={() => router.push('/dashboard/broker')}
              variant="outline"
              className="bg-white/10 border-white/30 text-white hover:bg-white/20"
            >
              ← Back
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Truck className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">In Transit</p>
              <p className="text-xl font-bold text-gray-900">
                {activeShipments.filter(s => s.status === 'in_transit').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <MapPin className="h-5 w-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">At Pickup</p>
              <p className="text-xl font-bold text-gray-900">
                {activeShipments.filter(s => s.status === 'at_pickup').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Package className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">At Delivery</p>
              <p className="text-xl font-bold text-gray-900">
                {activeShipments.filter(s => s.status === 'at_delivery').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <Clock className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-xs text-gray-500">Last Update</p>
              <p className="text-sm font-semibold text-gray-900">
                {lastRefresh.toLocaleTimeString()}
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Shipments List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search shipments..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full border border-gray-300 rounded-lg py-2 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="all">All Statuses</option>
                <option value="in_transit">In Transit</option>
                <option value="at_pickup">At Pickup</option>
                <option value="at_delivery">At Delivery</option>
              </select>

              <div className="flex items-center justify-between text-xs text-gray-500">
                <span>Auto-refresh</span>
                <button
                  onClick={() => setAutoRefresh(!autoRefresh)}
                  className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                    autoRefresh ? 'bg-blue-600' : 'bg-gray-200'
                  }`}
                >
                  <span
                    className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      autoRefresh ? 'translate-x-6' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>

          {/* Shipments */}
          <div className="space-y-3 max-h-[600px] overflow-y-auto">
            {filteredShipments.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center">
                <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-3" />
                <p className="text-sm font-medium text-gray-900 mb-1">No active shipments</p>
                <p className="text-xs text-gray-500">
                  {searchTerm || filterStatus !== 'all' 
                    ? 'Try adjusting your filters' 
                    : 'Active shipments will appear here'}
                </p>
              </div>
            ) : (
              filteredShipments.map((shipment) => (
                <div
                  key={shipment.id}
                  onClick={() => setSelectedShipment(shipment)}
                  className={`bg-white rounded-xl border p-4 cursor-pointer transition-all hover:shadow-md ${
                    selectedShipment?.id === shipment.id
                      ? 'border-blue-500 ring-2 ring-blue-200'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-3">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(shipment.status)}`}>
                      <Navigation className="h-3 w-3" />
                      {getStatusLabel(shipment.status)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>

                  {/* Route */}
                  <div className="space-y-2 mb-3">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Pickup</p>
                        <p className="text-sm font-medium text-gray-900">
                          {shipment.assignment.load_board?.shipment?.pickup_city}, {shipment.assignment.load_board?.shipment?.pickup_state}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Delivery</p>
                        <p className="text-sm font-medium text-gray-900">
                          {shipment.assignment.load_board?.shipment?.delivery_city}, {shipment.assignment.load_board?.shipment?.delivery_state}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Carrier */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 border-t pt-3">
                    <User className="h-3 w-3" />
                    <span>{shipment.assignment.carrier?.full_name || 'Unknown Carrier'}</span>
                  </div>

                  {/* Last Update */}
                  {shipment.lastUpdate && (
                    <div className="flex items-center gap-2 text-xs text-gray-500 mt-2">
                      <Clock className="h-3 w-3" />
                      <span>Updated {shipment.lastUpdate.toLocaleTimeString()}</span>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>

        {/* Map & Details */}
        <div className="lg:col-span-2 space-y-4">
          {/* Map */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <div className="h-[500px] bg-gray-100 relative">
              {/* Placeholder for actual map */}
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                  <p className="text-lg font-semibold text-gray-900 mb-2">Interactive Map</p>
                  <p className="text-sm text-gray-600 max-w-md">
                    Real-time tracking map will be displayed here showing all active shipments and driver locations.
                  </p>
                  <div className="mt-4 flex items-center justify-center gap-4">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Pickup</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Driver</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                      <span className="text-xs text-gray-600">Delivery</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Map Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button className="bg-white p-2 rounded-lg shadow-lg hover:bg-gray-50 transition-colors">
                  <Maximize2 className="h-5 w-5 text-gray-700" />
                </button>
              </div>
            </div>
          </div>

          {/* Selected Shipment Details */}
          {selectedShipment && (
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-gray-900">Shipment Details</h3>
                <button
                  onClick={() => setSelectedShipment(null)}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {/* Carrier Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Carrier</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {selectedShipment.assignment.carrier?.full_name || 'N/A'}
                      </span>
                    </div>
                    {selectedShipment.assignment.carrier?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`tel:${selectedShipment.assignment.carrier.phone}`}
                          className="text-sm text-blue-600 hover:text-blue-700"
                        >
                          {selectedShipment.assignment.carrier.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vehicle Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Vehicle</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900">
                      {selectedShipment.assignment.load_board?.shipment?.vehicle_year}{' '}
                      {selectedShipment.assignment.load_board?.shipment?.vehicle_make}{' '}
                      {selectedShipment.assignment.load_board?.shipment?.vehicle_model}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedShipment.assignment.load_board?.shipment?.vehicle_type}
                    </p>
                  </div>
                </div>

                {/* Commission */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Commission</h4>
                  <p className="text-xl font-bold text-green-600">
                    ${selectedShipment.assignment.broker_commission?.toLocaleString() || 'N/A'}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-3">Status</h4>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedShipment.status)}`}>
                    <Navigation className="h-4 w-4" />
                    {getStatusLabel(selectedShipment.status)}
                  </span>
                </div>
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="flex gap-3">
                  <Button
                    onClick={() => router.push(`/dashboard/broker/assignments/${selectedShipment.id}`)}
                    variant="outline"
                    className="flex-1"
                  >
                    View Full Details
                  </Button>
                  <Button
                    onClick={() => {
                      // Center map on this shipment
                      console.log('Center map on shipment');
                    }}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                  >
                    <MapPin className="h-4 w-4 mr-2" />
                    Center on Map
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
