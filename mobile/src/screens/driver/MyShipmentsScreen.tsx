import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { getApiUrl } from '../../utils/environment';

// Define the tabs for the top navigation
const Tab = createMaterialTopTabNavigator();

// Define the structure of a shipment object
interface Shipment {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  distance: number;
  earnings: number;
  customer_name: string;
  status: string;
  pickup_date: string;
  created_at: string;
}

// Component for the Active Shipments tab
function ActiveShipmentsTab({ navigation }: any) {
  const [activeShipments, setActiveShipments] = useState<Shipment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile, session } = useAuth();

  useEffect(() => {
    fetchActiveShipments();
  }, []);

  const fetchActiveShipments = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // Query shipments assigned to this driver that are in active statuses
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name)
        `)
        .eq('driver_id', userProfile.id)
        .in('status', ['assigned', 'picked_up', 'in_transit'])
        .order('pickup_date', { ascending: true });

      if (error) throw error;

      // Transform data
      const transformedShipments: Shipment[] = data.map((shipment: any) => ({
        id: shipment.id,
        title: shipment.title || 'Delivery Service',
        pickup_location: shipment.pickup_address || 'Unknown pickup',
        delivery_location: shipment.delivery_address || 'Unknown delivery',
        distance: shipment.distance || 0,
        earnings: shipment.estimated_price || 0,
        customer_name: shipment.profiles 
          ? `${shipment.profiles.first_name} ${shipment.profiles.last_name}`
          : 'Unknown Customer',
        status: shipment.status,
        pickup_date: shipment.pickup_date || shipment.created_at,
        created_at: shipment.created_at,
      }));

      setActiveShipments(transformedShipments);
    } catch (error) {
      console.error('Error fetching active shipments:', error);
      Alert.alert('Error', 'Failed to load active shipments.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveShipments().finally(() => setRefreshing(false));
  };

  const updateShipmentStatus = async (shipmentId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('shipments')
        .update({ 
          status: newStatus,
          updated_at: new Date().toISOString(),
          updated_by: userProfile?.id // Add the user ID who is updating
        })
        .eq('id', shipmentId);

      if (error) throw error;

      // Refresh the list
      fetchActiveShipments();
      Alert.alert('Success', `Shipment status updated to ${newStatus}`);
    } catch (error) {
      console.error('Error updating shipment status:', error);
      Alert.alert('Error', 'Failed to update shipment status.');
    }
  };

  const viewShipmentDetails = (shipmentId: string) => {
    navigation.navigate('ShipmentDetails_Driver', { shipmentId });
  };

  const openRouteMap = (shipmentId: string) => {
    navigation.navigate('RouteMap', { shipmentId });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'assigned': return Colors.warning;
      case 'picked_up': return Colors.info;
      case 'in_transit': return Colors.secondary;
      default: return Colors.text.secondary;
    }
  };

  const getStatusAction = (shipment: Shipment) => {
    switch (shipment.status) {
      case 'assigned':
        return {
          label: 'Mark Picked Up',
          action: () => updateShipmentStatus(shipment.id, 'picked_up'),
          icon: 'check-circle',
          color: Colors.success
        };
      case 'picked_up':
        return {
          label: 'Start Transit',
          action: () => updateShipmentStatus(shipment.id, 'in_transit'),
          icon: 'local-shipping',
          color: Colors.secondary
        };
      case 'in_transit':
        return {
          label: 'Complete Delivery',
          action: () => updateShipmentStatus(shipment.id, 'delivered'),
          icon: 'flag',
          color: Colors.primary
        };
      default:
        return null;
    }
  };

  const renderShipmentItem = ({ item }: { item: Shipment }) => {
    const statusAction = getStatusAction(item);
    
    return (
      <TouchableOpacity
        style={styles.shipmentCard}
        onPress={() => viewShipmentDetails(item.id)}
      >
        <View style={styles.shipmentHeader}>
          <Text style={styles.shipmentTitle}>{item.title}</Text>
          <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
            <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
              {item.status.replace('_', ' ').toUpperCase()}
            </Text>
          </View>
        </View>
        
        <Text style={styles.customerName}>Customer: {item.customer_name}</Text>
        
        <View style={styles.locationContainer}>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color={Colors.secondary} />
            <Text style={styles.locationText} numberOfLines={1}>
              From: {item.pickup_location}
            </Text>
          </View>
          <View style={styles.locationRow}>
            <MaterialIcons name="flag" size={16} color={Colors.primary} />
            <Text style={styles.locationText} numberOfLines={1}>
              To: {item.delivery_location}
            </Text>
          </View>
        </View>
        
        <View style={styles.detailsContainer}>
          <Text style={styles.earningsText}>${item.earnings}</Text>
          <Text style={styles.dateText}>
            {new Date(item.pickup_date).toLocaleDateString()}
          </Text>
        </View>
        
        <View style={styles.actionContainer}>
          <TouchableOpacity
            style={styles.mapButton}
            onPress={() => openRouteMap(item.id)}
          >
            <MaterialIcons name="map" size={16} color={Colors.primary} />
            <Text style={styles.mapButtonText}>Route</Text>
          </TouchableOpacity>
          
          {statusAction && (
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: statusAction.color }]}
              onPress={statusAction.action}
            >
              <MaterialIcons name={statusAction.icon as any} size={16} color={Colors.background} />
              <Text style={styles.actionButtonText}>{statusAction.label}</Text>
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <FlatList
        data={activeShipments}
        renderItem={renderShipmentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={64} color={Colors.text.secondary} />
            <Text style={styles.emptyTitle}>No Active Shipments</Text>
            <Text style={styles.emptyText}>
              Your assigned shipments will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Component for the Completed Shipments tab
function CompletedShipmentsTab({ navigation }: any) {
  const [completedShipments, setCompletedShipments] = useState<Shipment[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile, session } = useAuth();

  useEffect(() => {
    fetchCompletedShipments();
  }, []);

  const fetchCompletedShipments = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name)
        `)
        .eq('driver_id', userProfile.id)
        .in('status', ['delivered', 'completed'])
        .order('updated_at', { ascending: false })
        .limit(50); // Limit to recent completed shipments

      if (error) throw error;

      const transformedShipments: Shipment[] = data.map((shipment: any) => ({
        id: shipment.id,
        title: shipment.title || 'Delivery Service',
        pickup_location: shipment.pickup_address || 'Unknown pickup',
        delivery_location: shipment.delivery_address || 'Unknown delivery',
        distance: shipment.distance || 0,
        earnings: shipment.estimated_price || 0,
        customer_name: shipment.profiles 
          ? `${shipment.profiles.first_name} ${shipment.profiles.last_name}`
          : 'Unknown Customer',
        status: shipment.status,
        pickup_date: shipment.pickup_date || shipment.created_at,
        created_at: shipment.created_at,
      }));

      setCompletedShipments(transformedShipments);
    } catch (error) {
      console.error('Error fetching completed shipments:', error);
      Alert.alert('Error', 'Failed to load completed shipments.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCompletedShipments().finally(() => setRefreshing(false));
  };

  const viewShipmentDetails = (shipmentId: string) => {
    navigation.navigate('ShipmentDetails_Driver', { shipmentId });
  };

  const renderShipmentItem = ({ item }: { item: Shipment }) => (
    <TouchableOpacity
      style={styles.shipmentCard}
      onPress={() => viewShipmentDetails(item.id)}
    >
      <View style={styles.shipmentHeader}>
        <Text style={styles.shipmentTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: Colors.success + '20' }]}>
          <Text style={[styles.statusText, { color: Colors.success }]}>
            COMPLETED
          </Text>
        </View>
      </View>
      
      <Text style={styles.customerName}>Customer: {item.customer_name}</Text>
      
      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            From: {item.pickup_location}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="flag" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            To: {item.delivery_location}
          </Text>
        </View>
      </View>
      
      <View style={styles.detailsContainer}>
        <Text style={styles.earningsText}>${item.earnings}</Text>
        <Text style={styles.dateText}>
          Completed: {new Date(item.pickup_date).toLocaleDateString()}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={completedShipments}
        renderItem={renderShipmentItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="history" size={64} color={Colors.text.secondary} />
            <Text style={styles.emptyTitle}>No Completed Shipments</Text>
            <Text style={styles.emptyText}>
              Your completed deliveries will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Component for the Applications tab
function ApplicationsTab({ navigation }: any) {
  const [applications, setApplications] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile, session } = useAuth();

  useEffect(() => {
    fetchApplications();
  }, []);

  const fetchApplications = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // Check if API URL is configured
      const apiUrl = getApiUrl();
      if (!apiUrl) {
        throw new Error('API URL is not configured. Please check your environment variables.');
      }
      
      console.log('Fetching from:', `${apiUrl}/api/v1/drivers/applications`);
      
      // Use the backend API to get driver applications
      const response = await fetch(`${apiUrl}/api/v1/drivers/applications`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session?.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      // Handle response (even if it's not JSON)
      let result;
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        const text = await response.text();
        throw new Error(`Invalid response format: ${text}`);
      }

      if (response.ok && result.success) {
        setApplications(result.data || []);
      } else {
        throw new Error(result.error?.message || `Failed to fetch applications: ${response.status} ${response.statusText}`);
      }
    } catch (error) {
      console.error('Error fetching applications:', error);
      // More detailed error message
      let errorMessage = 'Failed to load applications.';
      if (error instanceof Error) {
        if (error.message.includes('Network request failed')) {
          errorMessage = 'Network request failed. Please check your internet connection and make sure the API server is running.';
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      Alert.alert('Error Loading Applications', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchApplications().finally(() => setRefreshing(false));
  };

  const cancelApplication = async (applicationId: string) => {
    try {
      const apiUrl = getApiUrl();
      const response = await fetch(`${apiUrl}/api/v1/applications/${applicationId}/status`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({
          status: 'cancelled',
          notes: 'Cancelled by driver via mobile app'
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        Alert.alert('Success', 'Application cancelled successfully.');
        fetchApplications(); // Refresh the list
      } else {
        throw new Error(result.error?.message || 'Failed to cancel application');
      }
    } catch (error) {
      console.error('Error cancelling application:', error);
      Alert.alert('Error', 'Failed to cancel application.');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return Colors.warning;
      case 'accepted': return Colors.success;
      case 'rejected': return Colors.error;
      case 'cancelled': return Colors.text.secondary;
      default: return Colors.text.secondary;
    }
  };

  const renderApplicationItem = ({ item }: { item: any }) => (
    <View style={styles.shipmentCard}>
      <View style={styles.shipmentHeader}>
        <Text style={styles.shipmentTitle}>{item.shipment_title || 'Delivery Service'}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {item.status.toUpperCase()}
          </Text>
        </View>
      </View>
      
      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            From: {item.shipment_pickup_address}
          </Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="flag" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            To: {item.shipment_delivery_address}
          </Text>
        </View>
      </View>
      
      {item.notes && (
        <Text style={styles.notesText}>Notes: {item.notes}</Text>
      )}
      
      <View style={styles.detailsContainer}>
        <Text style={styles.earningsText}>${item.shipment_estimated_price}</Text>
        <Text style={styles.dateText}>
          Applied: {new Date(item.applied_at).toLocaleDateString()}
        </Text>
      </View>
      
      {item.status === 'pending' && (
        <TouchableOpacity
          style={styles.cancelButton}
          onPress={() => cancelApplication(item.id)}
        >
          <MaterialIcons name="cancel" size={16} color={Colors.error} />
          <Text style={styles.cancelButtonText}>Cancel Application</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={applications}
        renderItem={renderApplicationItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            colors={[Colors.primary]}
            tintColor={Colors.primary}
          />
        }
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="send" size={64} color={Colors.text.secondary} />
            <Text style={styles.emptyTitle}>No Applications</Text>
            <Text style={styles.emptyText}>
              Your shipment applications will appear here.
            </Text>
          </View>
        }
      />
    </View>
  );
}

// Main component with tab navigation
export default function MyShipmentsScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="dark" />
      <Tab.Navigator
        screenOptions={{
          tabBarActiveTintColor: Colors.primary,
          tabBarInactiveTintColor: Colors.text.secondary,
          tabBarStyle: {
            backgroundColor: Colors.background,
            elevation: 0,
            shadowOpacity: 0,
            borderBottomWidth: 1,
            borderBottomColor: Colors.border,
          },
          tabBarIndicatorStyle: {
            backgroundColor: Colors.primary,
            height: 3,
          },
          tabBarLabelStyle: {
            fontSize: 12,
            fontWeight: '600',
            textTransform: 'none',
          },
        }}
      >
        <Tab.Screen 
          name="Active" 
          component={ActiveShipmentsTab}
          options={{ tabBarLabel: 'Active' }}
        />
        <Tab.Screen 
          name="Completed" 
          component={CompletedShipmentsTab}
          options={{ tabBarLabel: 'Completed' }}
        />
        <Tab.Screen 
          name="Applications" 
          component={ApplicationsTab}
          options={{ tabBarLabel: 'Applications' }}
        />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    padding: 16,
  },
  shipmentCard: {
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  shipmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 10,
    fontWeight: 'bold',
  },
  customerName: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  locationContainer: {
    marginBottom: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  locationText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    flex: 1,
  },
  detailsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningsText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.success,
  },
  dateText: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  actionContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  mapButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  mapButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    marginLeft: 4,
  },
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 16,
  },
  actionButtonText: {
    color: Colors.background,
    fontWeight: '600',
    marginLeft: 4,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    marginTop: 8,
  },
  cancelButtonText: {
    color: Colors.error,
    fontWeight: '600',
    marginLeft: 4,
  },
  notesText: {
    fontSize: 12,
    color: Colors.text.secondary,
    fontStyle: 'italic',
    marginBottom: 8,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingTop: 100,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
