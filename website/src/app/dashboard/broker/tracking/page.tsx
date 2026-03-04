'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
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
  AlertCircle,
  Locate
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
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<google.maps.Marker[]>([]);
  
  const [loading, setLoading] = useState(true);
  const [broker, setBroker] = useState<BrokerProfile | null>(null);
  const [activeShipments, setActiveShipments] = useState<ActiveShipment[]>([]);
  const [selectedShipment, setSelectedShipment] = useState<ActiveShipment | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'in_transit' | 'at_pickup' | 'at_delivery'>('all');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const initializeMap = useCallback(() => {
    if (!mapContainerRef.current || !window.google?.maps) return;
    if (mapRef.current) return; // already initialized

    const map = new google.maps.Map(mapContainerRef.current, {
      center: { lat: 35.2271, lng: -80.8431 }, // Charlotte, NC default
      zoom: 7,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      styles: [
        { featureType: 'poi', elementType: 'labels', stylers: [{ visibility: 'off' }] },
      ],
    });
    mapRef.current = map;
  }, []);

  const updateMapMarkers = useCallback((shipments: ActiveShipment[]) => {
    // Clear existing markers
    markersRef.current.forEach(m => m.setMap(null));
    markersRef.current = [];

    if (!mapRef.current || !window.google?.maps) return;
    const bounds = new google.maps.LatLngBounds();
    const geocoder = new google.maps.Geocoder();
    let hasPoints = false;
    let geocodeCount = 0;
    const MAX_GEOCODES = 10; // Limit to avoid rate limits

    shipments.forEach(shipment => {
      // Use the shipment data from the assignment (loaded via shipments join)
      const s = shipment.assignment?.shipment;
      const pickupAddr = s?.pickup_address || s?.pickup_city ? `${s?.pickup_city || ''}, ${s?.pickup_state || ''}` : '';
      const deliveryAddr = s?.dropoff_address || s?.delivery_city ? `${s?.delivery_city || ''}, ${s?.delivery_state || ''}` : '';

      // Geocode pickup (with rate limit)
      if (pickupAddr && pickupAddr !== ', ' && geocodeCount < MAX_GEOCODES) {
        geocodeCount++;
        geocoder.geocode({ address: pickupAddr }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const pos = results[0].geometry.location;
            const marker = new google.maps.Marker({
              position: pos,
              map: mapRef.current!,
              title: `Pickup: ${pickupAddr}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#22c55e',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
            });
            markersRef.current.push(marker);
            bounds.extend(pos);
            if (hasPoints) mapRef.current?.fitBounds(bounds, 60);
            hasPoints = true;
          }
        });
      }

      // Geocode delivery (with rate limit)
      if (deliveryAddr && deliveryAddr !== ', ' && geocodeCount < MAX_GEOCODES) {
        geocodeCount++;
        geocoder.geocode({ address: deliveryAddr }, (results, status) => {
          if (status === 'OK' && results?.[0]) {
            const pos = results[0].geometry.location;
            const marker = new google.maps.Marker({
              position: pos,
              map: mapRef.current!,
              title: `Delivery: ${deliveryAddr}`,
              icon: {
                path: google.maps.SymbolPath.CIRCLE,
                scale: 8,
                fillColor: '#ef4444',
                fillOpacity: 1,
                strokeColor: '#fff',
                strokeWeight: 2,
              },
            });
            markersRef.current.push(marker);
            bounds.extend(pos);
            mapRef.current?.fitBounds(bounds, 60);
            hasPoints = true;
          }
        });
      }
    });
  }, []);

  useEffect(() => {
    loadData();

    // Retry map init until Google Maps loads
    const mapInterval = setInterval(() => {
      if (window.google?.maps && mapContainerRef.current && !mapRef.current) {
        initializeMap();
        clearInterval(mapInterval);
      }
    }, 500);
    // Also try immediately
    initializeMap();

    // Auto-refresh every 30 seconds
    const refreshInterval = setInterval(() => {
      if (autoRefresh) {
        loadData();
      }
    }, 30000);

    return () => {
      clearInterval(mapInterval);
      clearInterval(refreshInterval);
    };
  }, [autoRefresh, initializeMap]);

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

  const getFilteredShipments = () => {
    let filtered = [...activeShipments];

    if (filterStatus !== 'all') {
      filtered = filtered.filter(s => s.status === filterStatus);
    }

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(s =>
        s.id.toLowerCase().includes(term) ||
        `${s.assignment.carrier?.first_name || ''} ${s.assignment.carrier?.last_name || ''}`.toLowerCase().includes(term)
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
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-500 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading tracking data...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="border border-gray-200 rounded-md p-4">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">Live Tracking</h1>
            <p className="text-xs text-gray-500">
              Real-time monitoring of {activeShipments.length} active shipment{activeShipments.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex gap-3">
            <Button
              onClick={() => loadData()}
              className="bg-teal-500 hover:bg-teal-600 text-white"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* Stats Bar */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-teal-100 rounded-md flex items-center justify-center">
              <Truck className="h-5 w-5 text-teal-500" />
            </div>
            <div>
              <p className="text-xs text-gray-500">In Transit</p>
              <p className="text-xl font-bold text-gray-900">
                {activeShipments.filter(s => s.status === 'in_transit').length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-yellow-100 rounded-md flex items-center justify-center">
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

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-green-100 rounded-md flex items-center justify-center">
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

        <div className="bg-white rounded-md border border-gray-200 p-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-purple-100 rounded-md flex items-center justify-center">
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Shipments List */}
        <div className="lg:col-span-1 space-y-4">
          {/* Search & Filters */}
          <div className="bg-white rounded-md border border-gray-200 p-4">
            <div className="space-y-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search shipments..."
                  className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent text-sm"
                />
              </div>

              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value as any)}
                className="w-full border border-gray-300 rounded-md py-2 px-3 focus:outline-none focus:ring-1 focus:ring-teal-500 focus:border-transparent text-sm"
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
                    autoRefresh ? 'bg-teal-500' : 'bg-gray-200'
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
              <div className="bg-white rounded-md border border-gray-200 p-6 text-center">
                <AlertCircle className="h-8 w-8 text-gray-400 mx-auto mb-3" />
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
                  className={`bg-white rounded-md border p-3 cursor-pointer transition-colors ${
                    selectedShipment?.id === shipment.id
                      ? 'border-teal-500 ring-2 ring-teal-200'
                      : 'border-gray-200'
                  }`}
                >
                  {/* Status Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getStatusColor(shipment.status)}`}>
                      <Navigation className="h-3 w-3" />
                      {getStatusLabel(shipment.status)}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
                  </div>

                  {/* Route */}
                  <div className="space-y-2 mb-2">
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-green-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Pickup</p>
                        <p className="text-sm font-medium text-gray-900">
                          {shipment.assignment.shipment?.pickup_city || shipment.assignment.shipment?.pickup_address || 'N/A'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-start gap-2">
                      <div className="w-2 h-2 bg-red-500 rounded-full mt-1.5"></div>
                      <div className="flex-1">
                        <p className="text-xs text-gray-500">Delivery</p>
                        <p className="text-sm font-medium text-gray-900">
                          {shipment.assignment.shipment?.delivery_city || shipment.assignment.shipment?.dropoff_address || 'N/A'}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Carrier */}
                  <div className="flex items-center gap-2 text-xs text-gray-600 border-t pt-3">
                    <User className="h-3 w-3" />
                    <span>{shipment.assignment.carrier?.first_name ? `${shipment.assignment.carrier.first_name} ${shipment.assignment.carrier.last_name || ''}`.trim() : 'Unknown Carrier'}</span>
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
          <div className="bg-white rounded-md border border-gray-200 overflow-hidden">
            <div className="h-[500px] relative">
              <div ref={mapContainerRef} className="h-full w-full" />
              {!mapRef.current && (
                <div className="absolute inset-0 flex items-center justify-center bg-gray-100">
                  <div className="text-center">
                    <MapPin className="h-10 w-10 text-gray-400 mx-auto mb-3" />
                    <p className="text-sm font-semibold text-gray-900 mb-2">Loading Map...</p>
                    <p className="text-sm text-gray-600">Initializing Google Maps</p>
                  </div>
                </div>
              )}

              {/* Map Controls */}
              <div className="absolute top-4 right-4 flex flex-col gap-2">
                <button
                  onClick={() => {
                    if (mapRef.current && activeShipments.length > 0) {
                      updateMapMarkers(activeShipments);
                    }
                  }}
                  className="bg-white p-2 rounded-md shadow hover:bg-gray-50 transition-colors"
                  title="Re-center map"
                >
                  <Locate className="h-5 w-5 text-gray-700" />
                </button>
                <button
                  onClick={() => {
                    if (mapContainerRef.current) {
                      mapContainerRef.current.requestFullscreen?.();
                    }
                  }}
                  className="bg-white p-2 rounded-md shadow hover:bg-gray-50 transition-colors"
                  title="Fullscreen"
                >
                  <Maximize2 className="h-5 w-5 text-gray-700" />
                </button>
              </div>

              {/* Legend */}
              <div className="absolute bottom-4 left-4 bg-white rounded-md shadow px-3 py-2 flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Pickup</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                  <span className="text-xs text-gray-600">Delivery</span>
                </div>
              </div>
            </div>
          </div>

          {/* Selected Shipment Details */}
          {selectedShipment && (
            <div className="bg-white rounded-md border border-gray-200 p-4">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-semibold text-gray-900">Shipment Details</h3>
                <button
                  onClick={() => setSelectedShipment(null)}
                  className="p-2 hover:bg-gray-100 rounded-md transition-colors"
                >
                  <X className="h-5 w-5 text-gray-500" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-4">
                {/* Carrier Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Carrier</h4>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4 text-gray-400" />
                      <span className="text-sm text-gray-900">
                        {selectedShipment.assignment.carrier?.first_name ? `${selectedShipment.assignment.carrier.first_name} ${selectedShipment.assignment.carrier.last_name || ''}`.trim() : 'N/A'}
                      </span>
                    </div>
                    {selectedShipment.assignment.carrier?.phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="h-4 w-4 text-gray-400" />
                        <a 
                          href={`tel:${selectedShipment.assignment.carrier.phone}`}
                          className="text-sm text-teal-600 hover:text-teal-700"
                        >
                          {selectedShipment.assignment.carrier.phone}
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Vehicle Info */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Vehicle</h4>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-900">
                      {selectedShipment.assignment.shipment?.vehicle_year}{' '}
                      {selectedShipment.assignment.shipment?.vehicle_make}{' '}
                      {selectedShipment.assignment.shipment?.vehicle_model}
                    </p>
                    <p className="text-xs text-gray-500">
                      {selectedShipment.assignment.shipment?.vehicle_type}
                    </p>
                  </div>
                </div>

                {/* Commission */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Commission</h4>
                  <p className="text-lg font-bold text-green-600">
                    ${selectedShipment.assignment.broker_commission?.toLocaleString() || 'N/A'}
                  </p>
                </div>

                {/* Status */}
                <div>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase mb-2">Status</h4>
                  <span className={`inline-flex items-center gap-1 px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(selectedShipment.status)}`}>
                    <Navigation className="h-4 w-4" />
                    {getStatusLabel(selectedShipment.status)}
                  </span>
                </div>
              </div>

              <div className="mt-4 pt-4 border-t border-gray-200">
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
                      if (!selectedShipment || !mapRef.current) return;
                      if (selectedShipment.currentLat && selectedShipment.currentLng) {
                        mapRef.current.setCenter({ lat: selectedShipment.currentLat, lng: selectedShipment.currentLng });
                        mapRef.current.setZoom(14);
                      } else {
                        // Geocode pickup address as fallback
                        const addr = selectedShipment.assignment.shipment?.pickup_address || selectedShipment.assignment.shipment?.pickup_city;
                        if (addr) {
                          const geocoder = new google.maps.Geocoder();
                          geocoder.geocode({ address: addr }, (results, status) => {
                            if (status === 'OK' && results?.[0]) {
                              mapRef.current?.setCenter(results[0].geometry.location);
                              mapRef.current?.setZoom(12);
                            }
                          });
                        }
                      }
                    }}
                    className="flex-1 bg-teal-500 hover:bg-teal-600 text-white"
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
