import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { ShipmentService } from '../../services/shipmentService';

// Define the structure of a job object
interface AvailableJob {
  id: string;
  title: string;
  pickup_location: string;
  delivery_location: string;
  distance: number;
  estimated_earnings: number;
  vehicle_type: string;
  pickup_date: string;
  status: string;
  created_at: string;
  hasApplied?: boolean; // Track if driver has applied
}

export default function AvailableJobsScreen({ navigation }: any) {
  const [availableJobs, setAvailableJobs] = useState<AvailableJob[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [loading, setLoading] = useState(true);
  const { userProfile } = useAuth();

  useEffect(() => {
    fetchAvailableJobs();
  }, []);

  const fetchAvailableJobs = async () => {
    setLoading(true);
    try {
      // Query available jobs that haven't been assigned yet
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Get driver's applications to check which jobs they've applied for
      let appliedJobIds: string[] = [];
      if (userProfile?.id) {
        const { data: applications, error: appError } = await supabase
          .from('job_applications')
          .select('shipment_id, status')
          .eq('driver_id', userProfile.id);

        if (!appError && applications) {
          console.log(`DriverScreen: Found ${applications.length} applications for driver ${userProfile.id}:`, 
            applications.map(a => ({shipment_id: a.shipment_id, status: a.status})));
          appliedJobIds = applications.map(app => app.shipment_id);
        } else if (appError) {
          console.error('Error fetching driver applications:', appError);
        }
      }
      
      // Transform the data for our UI
      const formattedJobs = data.map((job) => ({
        id: job.id,
        title: `Shipment #${job.id.substring(0, 8)}`,
        pickup_location: job.pickup_address || 'Address not specified',
        delivery_location: job.delivery_address || 'Address not specified',
        distance: job.distance || 0,
        estimated_earnings: job.estimated_price || 0,
        vehicle_type: job.vehicle_type || 'Standard',
        pickup_date: job.pickup_date || new Date().toISOString(),
        status: job.status,
        created_at: job.created_at,
        hasApplied: appliedJobIds.includes(job.id), // Check if driver has applied
      }));

      console.log(`DriverScreen: Showing ${formattedJobs.length} jobs, with ${formattedJobs.filter(j => j.hasApplied).length} marked as applied`);
      
      setAvailableJobs(formattedJobs);
    } catch (error) {
      console.error('Error fetching available jobs:', error);
      Alert.alert('Error', 'Failed to load available jobs. Please try again.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAvailableJobs();
  };

  const handleJobPress = (job: AvailableJob) => {
    navigation.navigate('JobDetails', { jobId: job.id });
  };

  const applyForJob = async (jobId: string) => {
    try {
      // Check if driver is eligible
      if (!userProfile) {
        Alert.alert('Error', 'You must complete your profile before applying for jobs.');
        return;
      }

      console.log(`DriverScreen: Driver ${userProfile.id} applying for job ${jobId}`);
      
      // DIAGNOSTIC: Check if any applications already exist for this job/driver combo
      const { data: existingApps, error: checkError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('shipment_id', jobId)
        .eq('driver_id', userProfile.id);
        
      if (checkError) {
        console.error('Error checking existing applications:', checkError);
      } else {
        console.log(`DriverScreen DIAGNOSTIC: Existing applications for job ${jobId} and driver ${userProfile.id}:`, 
          existingApps?.length ? existingApps : 'None found');
      }

      // Use the enhanced ShipmentService method
      const application = await ShipmentService.applyForShipment(jobId, userProfile.id);
      
      console.log(`DriverScreen: Successfully applied for job ${jobId}`, application);
      
      // VERIFICATION: Double check the application was created
      const { data: verifyApp, error: verifyError } = await supabase
        .from('job_applications')
        .select('*')
        .eq('shipment_id', jobId)
        .eq('driver_id', userProfile.id);
        
      if (verifyError) {
        console.error('Error verifying application was created:', verifyError);
      } else {
        console.log(`DriverScreen VERIFICATION: Applications after applying for job ${jobId}:`, 
          verifyApp?.length ? verifyApp : 'None found - POSSIBLE DATA ISSUE');
        
        if (!verifyApp?.length) {
          Alert.alert('Warning', 'Your application may not have been properly recorded. Please try again.');
          return;
        }
      }

      Alert.alert(
        'Success',
        'Application submitted successfully! You will be notified when the client makes a decision.',
        [{ text: 'OK', onPress: () => fetchAvailableJobs() }] // Refresh the list
      );
    } catch (error: any) {
      console.error('Error applying for job:', error);
      Alert.alert('Error', error.message || 'Failed to apply for job. Please try again.');
    }
  };

  const renderJobItem = ({ item }: { item: AvailableJob }) => (
    <TouchableOpacity 
      style={styles.jobCard}
      onPress={() => handleJobPress(item)}
    >
      <View style={styles.jobHeader}>
        <Text style={styles.jobTitle}>{item.title}</Text>
        <View style={styles.earnBadge}>
          <Text style={styles.earnText}>${(item.estimated_earnings / 100).toFixed(2)}</Text>
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

      <View style={styles.detailsRow}>
        <View style={styles.detailItem}>
          <MaterialIcons name="straighten" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>{item.distance} miles</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="local-shipping" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>{item.vehicle_type}</Text>
        </View>
        <View style={styles.detailItem}>
          <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
          <Text style={styles.detailText}>
            {new Date(item.pickup_date).toLocaleDateString()}
          </Text>
        </View>
      </View>

      <TouchableOpacity 
        style={[
          styles.applyButton, 
          item.hasApplied && styles.appliedButton
        ]}
        onPress={() => applyForJob(item.id)}
        disabled={item.hasApplied}
      >
        <Text style={[
          styles.applyButtonText,
          item.hasApplied && styles.appliedButtonText
        ]}>
          {item.hasApplied ? 'Applied' : 'Apply Now'}
        </Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );

  const renderEmptyList = () => (
    <View style={styles.emptyContainer}>
      <MaterialIcons name="search" size={64} color={Colors.text.disabled} />
      <Text style={styles.emptyTitle}>No Available Jobs</Text>
      <Text style={styles.emptyMessage}>
        Check back soon for new delivery opportunities
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top']}>
      <View style={styles.container}>
        <StatusBar style="light" />
        
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Available Jobs</Text>
        </View>

        <FlatList
          data={availableJobs}
          renderItem={renderJobItem}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContainer}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
          }
          ListEmptyComponent={loading ? null : renderEmptyList()}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: Colors.secondary, // Match header color
  },
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.secondary,
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
  earnBadge: {
    backgroundColor: Colors.secondary + '20', // 20% opacity
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  earnText: {
    color: Colors.secondary,
    fontWeight: 'bold',
    fontSize: 16,
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
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 20,
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
  applyButton: {
    backgroundColor: Colors.primary,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: Colors.primaryDark,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 2,
  },
  applyButtonText: {
    color: Colors.text.inverse,
    fontWeight: 'bold',
    fontSize: 16,
  },
  appliedButton: {
    backgroundColor: Colors.text.disabled,
    borderRadius: 12,
    paddingVertical: 14,
    alignItems: 'center',
  },
  appliedButtonText: {
    color: Colors.text.secondary,
    fontWeight: 'bold',
    fontSize: 16,
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
