'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { getSupabaseBrowserClient } from '@/lib/supabase-client';
import { 
  MapPin, 
  Navigation, 
  Clock, 
  Truck, 
  Phone, 
  MessageCircle,
  ChevronLeft,
  User
} from 'lucide-react';

interface Shipment {
  id: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  pickup_lat?: number;
  pickup_lng?: number;
  delivery_lat?: number;
  delivery_lng?: number;
  pickup_location?: any;
  delivery_location?: any;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  driver_id?: string;
  created_at: string;
}

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  phone?: string;
  avatar_url?: string;
}

interface DriverLocation {
  latitude: number;
  longitude: number;
  accuracy?: number;
  speed?: number;
  heading?: number;
  location_timestamp: string;
}

const TRACKABLE_STATUSES = ['pickup_verified', 'picked_up', 'in_transit'];

const STATUS_LABELS: Record<string, string> = {
  pending: 'Shipment Created',
  assigned: 'Driver Assigned',
  accepted: 'Driver Accepted',
  driver_en_route: 'Driver En Route to Pickup',
  driver_arrived: 'Driver Arrived at Pickup',
  pickup_verification_pending: 'Verifying Vehicle',
  pickup_verified: 'Vehicle Verified',
  picked_up: 'Vehicle Picked Up',
  in_transit: 'In Transit',
  delivered: 'Delivered',
  completed: 'Completed'
};

export default function TrackShipmentPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();
  
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [driver, setDriver] = useState<Driver | null>(null);
  const [driverLocation, setDriverLocation] = useState<DriverLocation | null>(null);
  const [eta, setEta] = useState<string | null>(null);
  const [distance, setDistance] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const mapRef = useRef<google.maps.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const driverMarkerRef = useRef<google.maps.Marker | null>(null);
  const pickupMarkerRef = useRef<google.maps.Marker | null>(null);
  const deliveryMarkerRef = useRef<google.maps.Marker | null>(null);
  const routePolylineRef = useRef<google.maps.Polyline | null>(null);

  // Fetch shipment data
  useEffect(() => {
    fetchShipmentData();
  }, [params.id]);

  // Subscribe to location updates
  useEffect(() => {
    if (!shipment || !TRACKABLE_STATUSES.includes(shipment.status)) {
      return;
    }

    const channel = supabase
      .channel(`driver-location-${params.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'driver_locations',
          filter: `shipment_id=eq.${params.id}`,
        },
        (payload: any) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const newLocation = payload.new as DriverLocation;
            // Convert coordinates to numbers
            newLocation.latitude = Number(newLocation.latitude);
            newLocation.longitude = Number(newLocation.longitude);
            if (newLocation.speed) newLocation.speed = Number(newLocation.speed);
            if (newLocation.heading) newLocation.heading = Number(newLocation.heading);
            if (newLocation.accuracy) newLocation.accuracy = Number(newLocation.accuracy);
            
            setDriverLocation(newLocation);
            updateDriverMarker(newLocation);
            
            // Only calculate ETA if coordinates are valid
            if (!isNaN(newLocation.latitude) && !isNaN(newLocation.longitude)) {
              calculateETA(newLocation);
            }
          }
        }
      )
      .subscribe();

    // Fetch initial location
    fetchLatestLocation();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [shipment, params.id]);

  // Initialize map when data is ready
  useEffect(() => {
    if (shipment && window.google && mapContainerRef.current) {
      initializeMap();
    }
  }, [shipment]);

  async function fetchShipmentData() {
    try {
      setLoading(true);
      
      // Fetch shipment data
      const { data: shipmentData, error: shipmentError } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', params.id)
        .single();

      if (shipmentError) throw shipmentError;
      
      // Try to extract coordinates from PostGIS geometry using RPC
      const { data: coords, error: coordsError } = await supabase.rpc('get_shipment_coordinates', {
        shipment_id: params.id
      });
      
      if (!coordsError && coords && coords.length > 0) {
        const coordData = coords[0];
        // Only set if coordinates are valid (not NULL)
        if (coordData.pickup_lat != null && coordData.pickup_lng != null) {
          shipmentData.pickup_lat = Number(coordData.pickup_lat);
          shipmentData.pickup_lng = Number(coordData.pickup_lng);
        }
        if (coordData.delivery_lat != null && coordData.delivery_lng != null) {
          shipmentData.delivery_lat = Number(coordData.delivery_lat);
          shipmentData.delivery_lng = Number(coordData.delivery_lng);
        }
      }
      
      setShipment(shipmentData);

      // Fetch driver if assigned
      if (shipmentData.driver_id) {
        const { data: driverData } = await supabase
          .from('profiles')
          .select('id, first_name, last_name, phone, avatar_url')
          .eq('id', shipmentData.driver_id)
          .single();

        if (driverData) {
          setDriver(driverData);
        }
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function fetchLatestLocation() {
    if (!shipment?.driver_id) return;

    const { data } = await supabase
      .from('driver_locations')
      .select('*')
      .eq('shipment_id', params.id)
      .order('location_timestamp', { ascending: false })
      .limit(1)
      .single();

    if (data) {
      // Convert coordinates to numbers
      data.latitude = Number(data.latitude);
      data.longitude = Number(data.longitude);
      if (data.speed) data.speed = Number(data.speed);
      if (data.heading) data.heading = Number(data.heading);
      if (data.accuracy) data.accuracy = Number(data.accuracy);
      
      setDriverLocation(data);
      updateDriverMarker(data);
      
      // Only calculate ETA if coordinates are valid
      if (!isNaN(data.latitude) && !isNaN(data.longitude)) {
        calculateETA(data);
      }
    }
  }

  function initializeMap() {
    if (!shipment || !mapContainerRef.current) return;
    
    // Validate coordinates exist
    if (!shipment.pickup_lat || !shipment.pickup_lng || !shipment.delivery_lat || !shipment.delivery_lng) {
      console.error('Missing shipment coordinates');
      setError('Unable to load map: location data is incomplete');
      return;
    }

    const center = {
      lat: Number(shipment.pickup_lat),
      lng: Number(shipment.pickup_lng),
    };

    mapRef.current = new google.maps.Map(mapContainerRef.current, {
      center,
      zoom: 12,
      styles: [
        {
          featureType: 'poi',
          elementType: 'labels',
          stylers: [{ visibility: 'off' }],
        },
      ],
    });

    // Add pickup marker
    pickupMarkerRef.current = new google.maps.Marker({
      position: { lat: Number(shipment.pickup_lat), lng: Number(shipment.pickup_lng) },
      map: mapRef.current,
      title: 'Pickup Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#3b82f6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    // Add delivery marker
    deliveryMarkerRef.current = new google.maps.Marker({
      position: { lat: Number(shipment.delivery_lat), lng: Number(shipment.delivery_lng) },
      map: mapRef.current,
      title: 'Delivery Location',
      icon: {
        path: google.maps.SymbolPath.CIRCLE,
        scale: 10,
        fillColor: '#10b981',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
      },
    });

    // If tracking is active and we have location, add driver marker
    if (TRACKABLE_STATUSES.includes(shipment.status) && driverLocation) {
      addDriverMarker(driverLocation);
    }

    // Fit bounds to show all markers
    const bounds = new google.maps.LatLngBounds();
    bounds.extend({ lat: Number(shipment.pickup_lat), lng: Number(shipment.pickup_lng) });
    bounds.extend({ lat: Number(shipment.delivery_lat), lng: Number(shipment.delivery_lng) });
    if (driverLocation) {
      bounds.extend({ lat: Number(driverLocation.latitude), lng: Number(driverLocation.longitude) });
    }
    mapRef.current.fitBounds(bounds);
  }

  function addDriverMarker(location: DriverLocation) {
    if (!mapRef.current) return;

    const position = {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
    };

    driverMarkerRef.current = new google.maps.Marker({
      position,
      map: mapRef.current,
      title: 'Driver Location',
      icon: {
        path: google.maps.SymbolPath.FORWARD_CLOSED_ARROW,
        scale: 6,
        fillColor: '#14b8a6',
        fillOpacity: 1,
        strokeColor: '#ffffff',
        strokeWeight: 2,
        rotation: location.heading || 0,
      },
    });
  }

  function updateDriverMarker(location: DriverLocation) {
    if (!driverMarkerRef.current || !mapRef.current) {
      if (mapRef.current && TRACKABLE_STATUSES.includes(shipment?.status || '')) {
        addDriverMarker(location);
      }
      return;
    }

    const position = {
      lat: Number(location.latitude),
      lng: Number(location.longitude),
    };

    // Smooth animation
    driverMarkerRef.current.setPosition(position);
    
    // Update rotation if heading available
    if (location.heading) {
      const icon = driverMarkerRef.current.getIcon() as google.maps.Symbol;
      driverMarkerRef.current.setIcon({
        ...icon,
        rotation: location.heading,
      });
    }

    // Pan map to new position
    mapRef.current.panTo(position);
  }

  async function calculateETA(location: DriverLocation) {
    if (!shipment || !window.google) return;

    // Ensure coordinates are valid numbers
    const originLat = Number(location.latitude);
    const originLng = Number(location.longitude);
    const destLat = Number(shipment.delivery_lat);
    const destLng = Number(shipment.delivery_lng);

    if (isNaN(originLat) || isNaN(originLng) || isNaN(destLat) || isNaN(destLng)) {
      console.error('Invalid coordinates for ETA calculation');
      return;
    }

    const service = new google.maps.DistanceMatrixService();
    
    service.getDistanceMatrix(
      {
        origins: [{ lat: originLat, lng: originLng }],
        destinations: [{ lat: destLat, lng: destLng }],
        travelMode: google.maps.TravelMode.DRIVING,
        drivingOptions: {
          departureTime: new Date(),
          trafficModel: google.maps.TrafficModel.BEST_GUESS,
        },
      },
      (response, status) => {
        if (status === 'OK' && response?.rows[0]?.elements[0]) {
          const element = response.rows[0].elements[0];
          if (element.status === 'OK') {
            setEta(element.duration.text);
            setDistance(element.distance.text);
          }
        }
      }
    );
  }

  function getStatusIndex(status: string): number {
    const statuses = Object.keys(STATUS_LABELS);
    return statuses.indexOf(status);
  }

  function getProgress(): number {
    if (!shipment) return 0;
    const currentIndex = getStatusIndex(shipment.status);
    const totalSteps = Object.keys(STATUS_LABELS).length - 1;
    return (currentIndex / totalSteps) * 100;
  }

  function handleMessageDriver() {
    if (driver) {
      router.push(`/dashboard/client/messages?conversation=${shipment?.driver_id}`);
    }
  }

  function handleCallDriver() {
    if (driver?.phone) {
      window.location.href = `tel:${driver.phone}`;
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-teal-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading tracking information...</p>
        </div>
      </div>
    );
  }

  if (error || !shipment) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">{error || 'Shipment not found'}</p>
          <button
            onClick={() => router.push('/dashboard/client/shipments')}
            className="text-teal-600 hover:text-teal-700"
          >
            Back to Shipments
          </button>
        </div>
      </div>
    );
  }

  const isTrackingActive = TRACKABLE_STATUSES.includes(shipment.status);

  return (
    <div className="h-screen flex flex-col">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button
              onClick={() => router.push(`/dashboard/client/shipments/${params.id}`)}
              className="text-gray-600 hover:text-gray-900"
            >
              <ChevronLeft className="h-6 w-6" />
            </button>
            <div>
              <h1 className="text-xl font-semibold text-gray-900">
                Track Shipment
              </h1>
              <p className="text-sm text-gray-600">
                {shipment.vehicle_year} {shipment.vehicle_make} {shipment.vehicle_model}
              </p>
            </div>
          </div>
          
          {driver && (
            <div className="flex gap-3">
              <button
                onClick={handleMessageDriver}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                <MessageCircle className="h-4 w-4" />
                Message
              </button>
              {driver.phone && (
                <button
                  onClick={handleCallDriver}
                  className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg hover:bg-teal-700"
                >
                  <Phone className="h-4 w-4" />
                  Call Driver
                </button>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Map Container */}
      <div className="flex-1 relative">
        {isTrackingActive ? (
          <div ref={mapContainerRef} className="w-full h-full" />
        ) : (
          <div className="w-full h-full flex items-center justify-center bg-gray-100">
            <div className="text-center p-8">
              <MapPin className="h-16 w-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">
                Live Tracking Not Available Yet
              </h3>
              <p className="text-gray-600 max-w-md">
                Real-time GPS tracking will be available once your vehicle has been picked up.
                This protects driver privacy during the pickup phase.
              </p>
              <div className="mt-6 p-4 bg-white rounded-lg border border-gray-200 inline-block">
                <p className="text-sm font-medium text-gray-700 mb-2">Current Status:</p>
                <p className="text-lg font-semibold text-teal-600">
                  {STATUS_LABELS[shipment.status] || shipment.status}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Info Panel */}
        <div className="absolute bottom-0 left-0 right-0 bg-white shadow-lg border-t">
          <div className="p-6">
            {/* Driver Info */}
            {driver && (
              <div className="flex items-center gap-4 mb-6 pb-6 border-b">
                <div className="h-12 w-12 rounded-full bg-gray-200 flex items-center justify-center">
                  {driver.avatar_url ? (
                    <img
                      src={driver.avatar_url}
                      alt={`${driver.first_name} ${driver.last_name}`}
                      className="h-12 w-12 rounded-full object-cover"
                    />
                  ) : (
                    <User className="h-6 w-6 text-gray-400" />
                  )}
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">
                    {driver.first_name} {driver.last_name}
                  </h3>
                  <p className="text-sm text-gray-600">Your Driver</p>
                </div>
              </div>
            )}

            {/* Stats */}
            {isTrackingActive && driverLocation && (
              <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Clock className="h-5 w-5 text-teal-600" />
                  </div>
                  <p className="text-sm text-gray-600">ETA</p>
                  <p className="font-semibold text-gray-900">
                    {eta || 'Calculating...'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Navigation className="h-5 w-5 text-teal-600" />
                  </div>
                  <p className="text-sm text-gray-600">Distance</p>
                  <p className="font-semibold text-gray-900">
                    {distance || 'Calculating...'}
                  </p>
                </div>
                
                <div className="text-center">
                  <div className="flex items-center justify-center mb-2">
                    <Truck className="h-5 w-5 text-teal-600" />
                  </div>
                  <p className="text-sm text-gray-600">Speed</p>
                  <p className="font-semibold text-gray-900">
                    {driverLocation.speed 
                      ? `${Math.round(driverLocation.speed * 2.237)} mph`
                      : '--'}
                  </p>
                </div>
              </div>
            )}

            {/* Progress Bar */}
            <div>
              <div className="flex justify-between text-xs text-gray-600 mb-2">
                <span>Pickup</span>
                <span>{STATUS_LABELS[shipment.status]}</span>
                <span>Delivery</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-teal-600 h-2 rounded-full transition-all duration-500"
                  style={{ width: `${getProgress()}%` }}
                />
              </div>
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-2 gap-4 mt-6 pt-6 border-t">
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">PICKUP</p>
                <p className="text-sm text-gray-900">{shipment.pickup_address}</p>
              </div>
              <div>
                <p className="text-xs font-medium text-gray-500 mb-1">DELIVERY</p>
                <p className="text-sm text-gray-900">{shipment.delivery_address}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
