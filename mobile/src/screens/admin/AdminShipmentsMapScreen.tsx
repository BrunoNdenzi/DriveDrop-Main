import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Modal,
  Linking,
  RefreshControl,
  Alert,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE, Region } from 'react-native-maps';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { parseLocationData, calculateDistance } from '../../utils/maps';
import { getGoogleMapsApiKey } from '../../utils/environment';
import { MapErrorBoundary } from '../../components/MapErrorBoundary';

interface ShipmentMapData {
  id: string;
  status: string;
  pickup_location: any;
  delivery_location: any;
  pickup_address: string;
  delivery_address: string;
  created_at: string;
  updated_at: string;
  driver?: {
    id: string;
    first_name: string;
    last_name: string;
    phone: string;
    avatar_url?: string;
  };
  customer?: {
    first_name: string;
    last_name: string;
    email: string;
  };
  driver_location?: {
    latitude: number;
    longitude: number;
    updated_at: string;
  };
}

interface FilterState {
  status: 'all' | 'pending' | 'assigned' | 'in_transit' | 'picked_up' | 'delivered' | 'completed' | 'cancelled';
  dateRange: '24h' | '7d' | '30d' | 'all';
  showDrivers: boolean;
}

// Only driver-relevant statuses (no draft, accepted, open, in_progress)
const STATUS_COLORS = {
  pending: '#F59E0B', // Orange
  assigned: '#2563EB', // Blue
  in_transit: '#10B981', // Green
  picked_up: '#8B5CF6', // Purple
  delivered: '#7C3AED', // Dark Purple
  completed: '#6B7280', // Gray
  cancelled: '#EF4444', // Red
};

const STATUS_LABELS = {
  pending: 'Pending',
  assigned: 'Assigned',
  in_transit: 'In Transit',
  picked_up: 'Picked Up',
  delivered: 'Delivered',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export default function AdminShipmentsMapScreen({ navigation }: any) {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [shipments, setShipments] = useState<ShipmentMapData[]>([]);
  const [filteredShipments, setFilteredShipments] = useState<ShipmentMapData[]>([]);
  const [allShipmentsStats, setAllShipmentsStats] = useState<any>(null); // For dashboard statistics
  const [selectedShipment, setSelectedShipment] = useState<ShipmentMapData | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [showLegend, setShowLegend] = useState(false);
  const [showStats, setShowStats] = useState(false);
  const [mapError, setMapError] = useState<string | null>(null);
  const [filters, setFilters] = useState<FilterState>({
    status: 'all',
    dateRange: '7d',
    showDrivers: true,
  });

  const mapRef = useRef<MapView>(null);
  const subscriptionRef = useRef<any>(null);

  useEffect(() => {
    checkGoogleMapsApi();
    loadShipments();
    loadAllStatistics(); // Load overall stats separately
    setupRealtimeSubscription();

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe();
      }
    };
  }, []);

  useEffect(() => {
    applyFilters();
  }, [shipments, filters]);

  const checkGoogleMapsApi = () => {
    const apiKey = getGoogleMapsApiKey();
    console.log('Google Maps API Key check:', {
      hasKey: !!apiKey,
      keyLength: apiKey?.length || 0
    });
    
    if (!apiKey) {
      setMapError('Google Maps is not properly configured');
      setLoading(false);
      Alert.alert(
        'Configuration Required',
        'Google Maps API key is not configured. Please contact support.',
        [{ text: 'OK', onPress: () => navigation.goBack() }]
      );
      return false;
    }
    return true;
  };

  const loadShipments = async () => {
    try {
      setLoading(true);

      // Calculate date filter
      let dateFilter = new Date();
      if (filters.dateRange === '24h') {
        dateFilter.setHours(dateFilter.getHours() - 24);
      } else if (filters.dateRange === '7d') {
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (filters.dateRange === '30d') {
        dateFilter.setDate(dateFilter.getDate() - 30);
      }

      let query = supabase
        .from('shipments')
        .select(`
          id,
          status,
          pickup_location,
          delivery_location,
          pickup_address,
          delivery_address,
          created_at,
          updated_at,
          driver:profiles!shipments_driver_id_fkey (
            id,
            first_name,
            last_name,
            phone,
            avatar_url
          ),
          customer:profiles!shipments_client_id_fkey (
            first_name,
            last_name,
            email
          )
        `)
        .order('updated_at', { ascending: false })
        .limit(500);

      // Apply date filter if not 'all'
      if (filters.dateRange !== 'all') {
        query = query.gte('created_at', dateFilter.toISOString());
      }

      // Apply status filter at query level for better performance
      // Only fetch driver-relevant statuses
      if (filters.status !== 'all') {
        query = query.eq('status', filters.status);
      } else {
        // When 'all' is selected, only show driver-relevant statuses
        // Exclude: draft, accepted, open, in_progress (not part of driver workflow)
        query = query.in('status', [
          'pending', 'assigned', 'in_transit', 'picked_up', 
          'delivered', 'completed', 'cancelled'
        ]);
      }

      const { data, error } = await query;

      if (error) throw error;

      console.log(`Loaded ${data?.length || 0} shipments from database`);

      // Parse locations and add driver locations
      const shipmentsWithLocations = await Promise.all(
        (data || []).map(async (shipment: any) => {
          const pickup = parseLocationData(shipment.pickup_location);
          const delivery = parseLocationData(shipment.delivery_location);

          // Get driver location if driver assigned
          let driverLocation = null;
          if (shipment.driver?.id) {
            const { data: locData } = await supabase
              .from('driver_locations')
              .select('latitude, longitude, location_timestamp')
              .eq('driver_id', shipment.driver.id)
              .order('location_timestamp', { ascending: false })
              .limit(1)
              .single();

            if (locData) {
              driverLocation = {
                latitude: locData.latitude,
                longitude: locData.longitude,
                updated_at: locData.location_timestamp,
              };
            }
          }

          return {
            ...shipment,
            pickup_location: pickup,
            delivery_location: delivery,
            driver_location: driverLocation,
          };
        })
      );

      setShipments(shipmentsWithLocations);
    } catch (error) {
      console.error('Error loading shipments:', error);
      Alert.alert('Error', 'Failed to load shipments');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  // Load overall statistics (all shipments, not filtered)
  const loadAllStatistics = async () => {
    try {
      // Get counts for all statuses
      const { data, error } = await supabase
        .from('shipments')
        .select('id, status, driver_id')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const total = data?.length || 0;
      const byStatus = data?.reduce((acc: any, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {});

      // Get drivers with recent locations (last 1 hour = online)
      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const { data: driversData } = await supabase
        .from('driver_locations')
        .select('driver_id, location_timestamp')
        .gte('location_timestamp', oneHourAgo.toISOString());

      const driversOnline = new Set(driversData?.map((d) => d.driver_id)).size;

      setAllShipmentsStats({ total, byStatus, driversOnline });
      console.log('All shipments statistics:', { total, byStatus, driversOnline });
    } catch (error) {
      console.error('Error loading statistics:', error);
    }
  };

  const setupRealtimeSubscription = () => {
    subscriptionRef.current = supabase
      .channel('admin_shipments_map')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'shipments',
        },
        (payload) => {
          console.log('Shipment updated:', payload);
          loadShipments();
          loadAllStatistics(); // Refresh statistics when shipments change
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'driver_locations',
        },
        (payload) => {
          console.log('Driver location updated:', payload);
          // Throttle full reload for driver location updates
          // In production, you'd want to update only the specific driver
          setTimeout(() => {
            loadShipments();
            loadAllStatistics();
          }, 5000);
        }
      )
      .subscribe();
  };

  const applyFilters = () => {
    let filtered = [...shipments];

    // Status filter
    if (filters.status !== 'all') {
      filtered = filtered.filter((s) => s.status === filters.status);
    }

    setFilteredShipments(filtered);
  };

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    loadShipments();
    loadAllStatistics(); // Also refresh statistics
  }, []);

  const fitMapToMarkers = () => {
    if (filteredShipments.length === 0) return;

    const coordinates: any[] = [];

    filteredShipments.forEach((shipment) => {
      if (shipment.pickup_location) {
        coordinates.push(shipment.pickup_location);
      }
      if (shipment.delivery_location) {
        coordinates.push(shipment.delivery_location);
      }
      if (filters.showDrivers && shipment.driver_location) {
        coordinates.push(shipment.driver_location);
      }
    });

    if (coordinates.length > 0 && mapRef.current) {
      mapRef.current.fitToCoordinates(coordinates, {
        edgePadding: { top: 100, right: 100, bottom: 100, left: 100 },
        animated: true,
      });
    }
  };

  const calculateStats = () => {
    // Use allShipmentsStats for overall statistics if available
    if (allShipmentsStats) {
      return allShipmentsStats;
    }

    // Fallback to filtered shipments if stats not loaded yet
    const total = filteredShipments.length;
    const byStatus = filteredShipments.reduce((acc: any, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {});

    const driversOnline = new Set(
      filteredShipments
        .filter((s) => s.driver_location)
        .map((s) => s.driver?.id)
    ).size;

    return { total, byStatus, driversOnline };
  };

  const openPhoneCall = (phone: string) => {
    Linking.openURL(`tel:${phone}`);
  };

  const getMarkerColor = (status: string): string => {
    return STATUS_COLORS[status as keyof typeof STATUS_COLORS] || '#6B7280';
  };

  const renderShipmentMarkers = () => {
    try {
      return filteredShipments.map((shipment) => {
        if (!shipment || !shipment.id) return null;
        
        const color = getMarkerColor(shipment.status);

        return (
          <React.Fragment key={shipment.id}>
            {/* Pickup Marker */}
            {shipment.pickup_location?.latitude && shipment.pickup_location?.longitude && (
              <Marker
                coordinate={shipment.pickup_location}
                onPress={() => setSelectedShipment(shipment)}
                pinColor={color}
              >
                <View style={[styles.customMarker, { backgroundColor: color }]}>
                  <MaterialIcons name="location-on" size={20} color="#FFF" />
                  <Text style={styles.markerText}>P</Text>
                </View>
              </Marker>
            )}

            {/* Delivery Marker */}
            {shipment.delivery_location?.latitude && shipment.delivery_location?.longitude && (
              <Marker
                coordinate={shipment.delivery_location}
                onPress={() => setSelectedShipment(shipment)}
              >
                <View style={[styles.customMarker, { backgroundColor: color }]}>
                  <MaterialIcons name="flag" size={20} color="#FFF" />
                  <Text style={styles.markerText}>D</Text>
                </View>
              </Marker>
            )}

            {/* Driver Location Marker */}
            {filters.showDrivers &&
              shipment.driver_location?.latitude && 
              shipment.driver_location?.longitude &&
              shipment.status !== 'completed' && (
              <Marker
                coordinate={shipment.driver_location}
                onPress={() => setSelectedShipment(shipment)}
                anchor={{ x: 0.5, y: 0.5 }}
              >
                <View style={[styles.driverMarker, { backgroundColor: color }]}>
                  <MaterialIcons name="local-shipping" size={24} color="#FFF" />
                </View>
              </Marker>
            )}

            {/* Route line if driver location available */}
            {filters.showDrivers &&
              shipment.driver_location &&
              shipment.status === 'in_transit' &&
              shipment.delivery_location && (
                <Polyline
                  coordinates={[shipment.driver_location, shipment.delivery_location]}
                  strokeColor={color}
                  strokeWidth={2}
                  lineDashPattern={[5, 5]}
                />
              )}
          </React.Fragment>
        );
      });
    } catch (error) {
      console.error('Error rendering shipment markers:', error);
      return null;
    }
  };

  const renderShipmentInfo = () => {
    if (!selectedShipment) return null;

    const distance = selectedShipment.driver_location && selectedShipment.delivery_location
      ? calculateDistance(
          selectedShipment.driver_location.latitude,
          selectedShipment.driver_location.longitude,
          selectedShipment.delivery_location.latitude,
          selectedShipment.delivery_location.longitude
        )
      : null;

    return (
      <View style={styles.infoCard}>
        <View style={styles.infoHeader}>
          <View style={styles.infoHeaderLeft}>
            <Text style={styles.infoTitle}>Shipment #{selectedShipment.id.slice(0, 8)}</Text>
            <View style={[styles.statusBadge, { backgroundColor: getMarkerColor(selectedShipment.status) }]}>
              <Text style={styles.statusText}>
                {STATUS_LABELS[selectedShipment.status as keyof typeof STATUS_LABELS]}
              </Text>
            </View>
          </View>
          <TouchableOpacity onPress={() => setSelectedShipment(null)}>
            <MaterialIcons name="close" size={24} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.infoContent}>
          {/* Driver Info */}
          {selectedShipment.driver && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Driver</Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="person" size={20} color={Colors.primary} />
                <Text style={styles.infoValue}>
                  {selectedShipment.driver.first_name} {selectedShipment.driver.last_name}
                </Text>
              </View>
              {selectedShipment.driver.phone && (
                <TouchableOpacity
                  style={styles.phoneButton}
                  onPress={() => openPhoneCall(selectedShipment.driver!.phone)}
                >
                  <MaterialIcons name="phone" size={20} color={Colors.primary} />
                  <Text style={styles.phoneText}>{selectedShipment.driver.phone}</Text>
                </TouchableOpacity>
              )}
              {selectedShipment.driver_location && (
                <Text style={styles.locationTime}>
                  Last updated: {new Date(selectedShipment.driver_location.updated_at).toLocaleTimeString()}
                </Text>
              )}
            </View>
          )}

          {/* Customer Info */}
          {selectedShipment.customer && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Customer</Text>
              <View style={styles.infoRow}>
                <MaterialIcons name="person-outline" size={20} color={Colors.primary} />
                <Text style={styles.infoValue}>
                  {selectedShipment.customer.first_name} {selectedShipment.customer.last_name}
                </Text>
              </View>
            </View>
          )}

          {/* Locations */}
          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Pickup</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="location-on" size={20} color="#10B981" />
              <Text style={styles.infoValue}>{selectedShipment.pickup_address}</Text>
            </View>
          </View>

          <View style={styles.infoSection}>
            <Text style={styles.infoLabel}>Delivery</Text>
            <View style={styles.infoRow}>
              <MaterialIcons name="flag" size={20} color="#EF4444" />
              <Text style={styles.infoValue}>{selectedShipment.delivery_address}</Text>
            </View>
          </View>

          {/* Distance to Delivery */}
          {distance && (
            <View style={styles.infoSection}>
              <Text style={styles.infoLabel}>Distance to Delivery</Text>
              <Text style={styles.distanceText}>{distance.toFixed(1)} km</Text>
            </View>
          )}

          {/* Actions */}
          <TouchableOpacity
            style={styles.detailsButton}
            onPress={() => {
              setSelectedShipment(null);
              navigation.navigate('ShipmentDetails', { shipmentId: selectedShipment.id });
            }}
          >
            <Text style={styles.detailsButtonText}>View Full Details</Text>
            <MaterialIcons name="arrow-forward" size={20} color="#FFF" />
          </TouchableOpacity>
        </ScrollView>
      </View>
    );
  };

  const renderFilterModal = () => {
    return (
      <Modal
        visible={showFilters}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilters(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filters</Text>
              <TouchableOpacity onPress={() => setShowFilters(false)}>
                <MaterialIcons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>

            {/* Status Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Status</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.filterScrollView}>
                <View style={styles.filterOptionsWrap}>
                  {['all', 'pending', 'assigned', 'in_transit', 'picked_up', 'delivered', 'completed', 'cancelled'].map((status) => (
                    <TouchableOpacity
                      key={status}
                      style={[
                        styles.filterOption,
                        filters.status === status && styles.filterOptionActive,
                      ]}
                      onPress={() => setFilters({ ...filters, status: status as any })}
                    >
                      <Text
                        style={[
                          styles.filterOptionText,
                          filters.status === status && styles.filterOptionTextActive,
                        ]}
                      >
                        {status === 'all' ? 'All' : STATUS_LABELS[status as keyof typeof STATUS_LABELS] || status.charAt(0).toUpperCase() + status.slice(1)}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </ScrollView>
            </View>

            {/* Date Range Filter */}
            <View style={styles.filterSection}>
              <Text style={styles.filterLabel}>Time Range</Text>
              <View style={styles.filterOptions}>
                {[
                  { value: '24h', label: 'Last 24 Hours' },
                  { value: '7d', label: 'Last 7 Days' },
                  { value: '30d', label: 'Last 30 Days' },
                  { value: 'all', label: 'All Time' },
                ].map((range) => (
                  <TouchableOpacity
                    key={range.value}
                    style={[
                      styles.filterOption,
                      filters.dateRange === range.value && styles.filterOptionActive,
                    ]}
                    onPress={() => {
                      setFilters({ ...filters, dateRange: range.value as any });
                      setShowFilters(false);
                      loadShipments();
                    }}
                  >
                    <Text
                      style={[
                        styles.filterOptionText,
                        filters.dateRange === range.value && styles.filterOptionTextActive,
                      ]}
                    >
                      {range.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Show Drivers Toggle */}
            <View style={styles.filterSection}>
              <View style={styles.toggleRow}>
                <Text style={styles.filterLabel}>Show Driver Locations</Text>
                <TouchableOpacity
                  style={[styles.toggle, filters.showDrivers && styles.toggleActive]}
                  onPress={() => setFilters({ ...filters, showDrivers: !filters.showDrivers })}
                >
                  <View style={[styles.toggleThumb, filters.showDrivers && styles.toggleThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={styles.applyButton}
              onPress={() => setShowFilters(false)}
            >
              <Text style={styles.applyButtonText}>Apply Filters</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    );
  };

  const renderLegend = () => {
    if (!showLegend) return null;

    return (
      <View style={styles.legend}>
        <View style={styles.legendHeader}>
          <Text style={styles.legendTitle}>Legend</Text>
          <TouchableOpacity onPress={() => setShowLegend(false)}>
            <MaterialIcons name="close" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.assigned }]} />
          <Text style={styles.legendText}>Assigned</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.in_transit }]} />
          <Text style={styles.legendText}>In Transit</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.picked_up }]} />
          <Text style={styles.legendText}>Picked Up</Text>
        </View>
        <View style={styles.legendItem}>
          <View style={[styles.legendColor, { backgroundColor: STATUS_COLORS.completed }]} />
          <Text style={styles.legendText}>Completed</Text>
        </View>
        <View style={styles.legendDivider} />
        <View style={styles.legendItem}>
          <MaterialIcons name="location-on" size={20} color={Colors.text.primary} />
          <Text style={styles.legendText}>Pickup Point</Text>
        </View>
        <View style={styles.legendItem}>
          <MaterialIcons name="flag" size={20} color={Colors.text.primary} />
          <Text style={styles.legendText}>Delivery Point</Text>
        </View>
        <View style={styles.legendItem}>
          <MaterialIcons name="local-shipping" size={20} color={Colors.text.primary} />
          <Text style={styles.legendText}>Driver Location</Text>
        </View>
      </View>
    );
  };

  const renderStats = () => {
    if (!showStats) return null;

    const stats = calculateStats();

    return (
      <View style={styles.statsPanel}>
        <View style={styles.statsHeader}>
          <Text style={styles.statsTitle}>Statistics</Text>
          <TouchableOpacity onPress={() => setShowStats(false)}>
            <MaterialIcons name="close" size={20} color={Colors.text.primary} />
          </TouchableOpacity>
        </View>
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.total}</Text>
            <Text style={styles.statLabel}>Total Shipments</Text>
          </View>
          <View style={styles.statCard}>
            <Text style={styles.statValue}>{stats.driversOnline}</Text>
            <Text style={styles.statLabel}>Drivers Online</Text>
          </View>
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <View key={status} style={styles.statCard}>
              <Text style={[styles.statValue, { color: getMarkerColor(status) }]}>
                {count as number}
              </Text>
              <Text style={styles.statLabel}>
                {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
              </Text>
            </View>
          ))}
        </View>
      </View>
    );
  };

  // Show error screen if map initialization failed
  if (mapError) {
    return (
      <View style={styles.container}>
        <StatusBar style="light" />
        <View style={styles.errorContainer}>
          <MaterialIcons name="error-outline" size={64} color={Colors.error} />
          <Text style={styles.errorTitle}>Map Unavailable</Text>
          <Text style={styles.errorMessage}>{mapError}</Text>
          <TouchableOpacity
            style={styles.retryButton}
            onPress={() => {
              setMapError(null);
              setLoading(true);
              if (checkGoogleMapsApi()) {
                loadShipments();
                loadAllStatistics();
              }
            }}
          >
            <Text style={styles.retryButtonText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => navigation.goBack()}
          >
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shipments map...</Text>
      </View>
    );
  }

  return (
    <MapErrorBoundary
      onRetry={loadShipments}
      fallbackMessage="Failed to load admin shipments map. Please check your internet connection and try again."
    >
      <View style={styles.container}>
        <StatusBar style="light" />

      {/* Map */}
      {!mapError && (
      <MapView
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 39.8283, // Center of USA
          longitude: -98.5795,
          latitudeDelta: 30,
          longitudeDelta: 30,
        }}
        onMapReady={() => {
          console.log('Admin map is ready');
          fitMapToMarkers();
        }}
      >
        {renderShipmentMarkers()}
      </MapView>
      )}

      {/* Top Bar */}
      <View style={styles.topBar}>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.title}>Shipments Map</Text>
        <View style={styles.topBarActions}>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowStats(!showStats)}>
            <MaterialIcons name="bar-chart" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowLegend(!showLegend)}>
            <MaterialIcons name="info" size={24} color="#FFF" />
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={() => setShowFilters(true)}>
            <MaterialIcons name="filter-list" size={24} color="#FFF" />
          </TouchableOpacity>
        </View>
      </View>

      {/* Floating Action Buttons */}
      <View style={styles.floatingButtons}>
        <TouchableOpacity style={styles.floatingButton} onPress={fitMapToMarkers}>
          <MaterialIcons name="center-focus-strong" size={24} color={Colors.primary} />
        </TouchableOpacity>
        <TouchableOpacity style={styles.floatingButton} onPress={handleRefresh}>
          <MaterialIcons name="refresh" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Legend */}
      {renderLegend()}

      {/* Stats */}
      {renderStats()}

      {/* Shipment Info Card */}
      {selectedShipment && renderShipmentInfo()}

      {/* Filter Modal */}
      {renderFilterModal()}
    </View>
    </MapErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  map: {
    ...StyleSheet.absoluteFillObject,
  },
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  backButton: {
    marginRight: 12,
  },
  title: {
    flex: 1,
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFF',
  },
  topBarActions: {
    flexDirection: 'row',
    gap: 8,
  },
  iconButton: {
    padding: 8,
  },
  floatingButtons: {
    position: 'absolute',
    right: 16,
    bottom: 100,
    gap: 12,
  },
  floatingButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFF',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  customMarker: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  markerText: {
    position: 'absolute',
    bottom: 2,
    fontSize: 10,
    fontWeight: 'bold',
    color: '#FFF',
  },
  driverMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  legend: {
    position: 'absolute',
    top: 130,
    right: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    minWidth: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  legendHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  legendTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  legendColor: {
    width: 20,
    height: 20,
    borderRadius: 10,
    marginRight: 8,
  },
  legendText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  legendDivider: {
    height: 1,
    backgroundColor: Colors.border,
    marginVertical: 8,
  },
  statsPanel: {
    position: 'absolute',
    top: 130,
    left: 16,
    backgroundColor: '#FFF',
    borderRadius: 12,
    padding: 16,
    maxWidth: 300,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  statsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  statsTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  statCard: {
    minWidth: 80,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  infoCard: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '60%',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 4,
    elevation: 5,
  },
  infoHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  infoHeaderLeft: {
    flex: 1,
  },
  infoTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  statusBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFF',
  },
  infoContent: {
    padding: 16,
  },
  infoSection: {
    marginBottom: 16,
  },
  infoLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.text.secondary,
    marginBottom: 6,
    textTransform: 'uppercase',
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  infoValue: {
    flex: 1,
    fontSize: 15,
    color: Colors.text.primary,
  },
  phoneButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    padding: 8,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  phoneText: {
    fontSize: 15,
    color: Colors.primary,
    fontWeight: '500',
  },
  locationTime: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
  },
  distanceText: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  detailsButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    marginTop: 8,
    gap: 8,
  },
  detailsButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  filterSection: {
    marginBottom: 24,
  },
  filterLabel: {
    fontSize: 14,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  filterScrollView: {
    maxHeight: 120,
  },
  filterOptionsWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    paddingRight: 16,
  },
  filterOptions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterOption: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: '#FFF',
    marginRight: 8,
    marginBottom: 8,
  },
  filterOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterOptionText: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  filterOptionTextActive: {
    color: '#FFF',
    fontWeight: '600',
  },
  toggleRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  toggle: {
    width: 50,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#E0E0E0',
    padding: 2,
  },
  toggleActive: {
    backgroundColor: Colors.primary,
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#FFF',
  },
  toggleThumbActive: {
    transform: [{ translateX: 22 }],
  },
  applyButton: {
    backgroundColor: Colors.primary,
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
  },
  applyButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFF',
  },
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: Colors.background,
  },
  errorTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorMessage: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginBottom: 24,
  },
  retryButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '600',
  },
});
