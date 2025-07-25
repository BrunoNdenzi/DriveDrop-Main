import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { createMaterialTopTabNavigator } from '@react-navigation/material-top-tabs';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

// Define the tabs for the top navigation
const Tab = createMaterialTopTabNavigator();

// Define the structure of a job object
interface Job {
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

// Component for the Active Jobs tab
function ActiveJobsTab({ navigation }: any) {
  const [activeJobs, setActiveJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchActiveJobs();
  }, []);

  const fetchActiveJobs = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // Query jobs assigned to this driver that are in active statuses
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name)
        `)
        .eq('driver_id', userProfile.id)
        .in('status', ['accepted', 'in_transit'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data for our UI
      const formattedJobs = data.map((job) => ({
        id: job.id,
        title: `Shipment #${job.id.substring(0, 8)}`,
        pickup_location: job.pickup_address || 'Address not specified',
        delivery_location: job.delivery_address || 'Address not specified',
        distance: job.distance || 0,
        earnings: job.price || 0,
        customer_name: job.profiles ? `${job.profiles.first_name} ${job.profiles.last_name}` : 'Customer',
        status: job.status,
        pickup_date: job.pickup_date || new Date().toISOString(),
        created_at: job.created_at,
      }));

      setActiveJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching active jobs:', error);
      Alert.alert('Error', 'Failed to load your active jobs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchActiveJobs();
  };

  const handleJobPress = (job: Job) => {
    navigation.navigate('JobDetails', { jobId: job.id });
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'accepted':
        return Colors.status.accepted;
      case 'in_transit':
        return Colors.status.in_transit;
      default:
        return Colors.text.secondary;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'accepted':
        return 'Accepted';
      case 'in_transit':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return status.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    }
  };

  const renderJobItem = ({ item }: { item: Job }) => (
    <TouchableOpacity 
      style={styles.jobCard}
      onPress={() => handleJobPress(item)}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Text style={[styles.statusText, { color: getStatusColor(item.status) }]}>
            {getStatusLabel(item.status)}
          </Text>
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.primary} />
          <Text style={styles.locationText}>Pickup: {item.pickup_location}</Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="flag" size={16} color={Colors.secondary} />
          <Text style={styles.locationText}>Delivery: {item.delivery_location}</Text>
        </View>
      </View>

      <View style={styles.customerRow}>
        <MaterialIcons name="person" size={16} color={Colors.text.secondary} />
        <Text style={styles.customerText}>Customer: {item.customer_name}</Text>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialIcons name="straighten" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>{item.distance} miles</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="attach-money" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>${item.earnings.toFixed(2)}</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>
            {new Date(item.pickup_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="assignment" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Active Jobs</Text>
      <Text style={styles.emptyMessage}>
        You don't have any active jobs at the moment.
      </Text>
    </View>
  );

  return (
    <View style={styles.tabContainer}>
      <FlatList
        data={activeJobs}
        renderItem={renderJobItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={loading ? null : renderEmptyList()}
      />
    </View>
  );
}

// Component for the Completed Jobs tab
function CompletedJobsTab({ navigation }: any) {
  const [completedJobs, setCompletedJobs] = useState<Job[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchCompletedJobs();
  }, []);

  const fetchCompletedJobs = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // Query jobs assigned to this driver that are completed
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          *,
          profiles:client_id(first_name, last_name)
        `)
        .eq('driver_id', userProfile.id)
        .eq('status', 'delivered')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      
      // Transform the data for our UI
      const formattedJobs = data.map((job) => ({
        id: job.id,
        title: `Shipment #${job.id.substring(0, 8)}`,
        pickup_location: job.pickup_address || 'Address not specified',
        delivery_location: job.delivery_address || 'Address not specified',
        distance: job.distance || 0,
        earnings: job.price || 0,
        customer_name: job.profiles ? `${job.profiles.first_name} ${job.profiles.last_name}` : 'Customer',
        status: job.status,
        pickup_date: job.pickup_date || new Date().toISOString(),
        created_at: job.created_at,
      }));

      setCompletedJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching completed jobs:', error);
      Alert.alert('Error', 'Failed to load your completed jobs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCompletedJobs();
  };

  const handleJobPress = (job: Job) => {
    navigation.navigate('JobDetails', { jobId: job.id });
  };

  const renderJobItem = ({ item }: { item: Job }) => (
    <TouchableOpacity 
      style={styles.jobCard}
      onPress={() => handleJobPress(item)}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <View style={[styles.statusBadge, { backgroundColor: Colors.status.delivered + '20' }]}>
          <Text style={[styles.statusText, { color: Colors.status.delivered }]}>
            Delivered
          </Text>
        </View>
      </View>

      <View style={styles.locationContainer}>
        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.primary} />
          <Text style={styles.locationText}>Pickup: {item.pickup_location}</Text>
        </View>
        <View style={styles.locationRow}>
          <MaterialIcons name="flag" size={16} color={Colors.secondary} />
          <Text style={styles.locationText}>Delivery: {item.delivery_location}</Text>
        </View>
      </View>

      <View style={styles.customerRow}>
        <MaterialIcons name="person" size={16} color={Colors.text.secondary} />
        <Text style={styles.customerText}>Customer: {item.customer_name}</Text>
      </View>

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialIcons name="straighten" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>{item.distance} miles</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="attach-money" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>${item.earnings.toFixed(2)}</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>
            {new Date(item.pickup_date).toLocaleDateString()}
          </Text>
        </View>
      </View>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="check-circle" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Completed Jobs</Text>
      <Text style={styles.emptyMessage}>
        Your completed jobs will appear here.
      </Text>
    </View>
  );

  return (
    <View style={styles.tabContainer}>
      <FlatList
        data={completedJobs}
        renderItem={renderJobItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContainer}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
        ListEmptyComponent={loading ? null : renderEmptyList()}
      />
    </View>
  );
}

export default function MyJobsScreen() {
  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.headerTitle}>My Jobs</Text>
      </View>

      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: Colors.background },
          tabBarActiveTintColor: Colors.secondary,
          tabBarInactiveTintColor: Colors.text.secondary,
          tabBarIndicatorStyle: { backgroundColor: Colors.secondary },
          tabBarLabelStyle: { fontWeight: '600' },
        }}
      >
        <Tab.Screen name="Active" component={ActiveJobsTab} />
        <Tab.Screen name="Completed" component={CompletedJobsTab} />
      </Tab.Navigator>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    borderBottomLeftRadius: 15,
    borderBottomRightRadius: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  headerTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: Colors.text.inverse,
  },
  tabContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  listContainer: {
    padding: 16,
    paddingBottom: 80,
  },
  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
  },
  jobTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  locationContainer: {
    marginBottom: 16,
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    paddingLeft: 12,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  locationText: {
    fontSize: 15,
    color: Colors.text.primary,
    marginLeft: 8,
    flex: 1,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  customerText: {
    fontSize: 15,
    color: Colors.text.primary,
    marginLeft: 8,
    fontWeight: '500',
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: Colors.background,
    borderRadius: 12,
    padding: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 5,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 6,
    fontWeight: '500',
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptyMessage: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
