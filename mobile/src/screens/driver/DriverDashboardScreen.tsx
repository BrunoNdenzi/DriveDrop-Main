import React, { useState, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, ScrollView, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { ShipmentService } from '../../services/shipmentService';

export default function DriverDashboardScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState({
    activeJobs: 0,
    pendingJobs: 0,
    completedJobs: 0,
    totalEarnings: 0,
  });
  const [availableJobs, setAvailableJobs] = useState<any[]>([]);
  const [isAvailable, setIsAvailable] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    if (!userProfile) return;
    
    try {
      setLoading(true);
      
      // Fetch driver stats
      const [activeJobsResult, completedJobsResult] = await Promise.all([
        // Active jobs count
        supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('driver_id', userProfile.id)
          .in('status', ['accepted', 'in_transit']),
        
        // Completed jobs count and earnings
        supabase
          .from('shipments')
          .select('estimated_price')
          .eq('driver_id', userProfile.id)
          .eq('status', 'delivered'),
      ]);

      // Get available jobs using ShipmentService
      const availableJobsData = await ShipmentService.getAvailableShipments(userProfile.id);

      // Get all applications for this driver for tracking purposes
      const { data: applications, error: appsError } = await supabase
        .from('job_applications')
        .select('shipment_id, status')
        .eq('driver_id', userProfile.id);

      if (appsError) {
        console.error('Error fetching driver applications:', appsError);
      } else {
        console.log(`DriverScreen: Found ${applications?.length || 0} applications for driver ${userProfile.id}:`, applications);
        
        // Update the pendingJobs count in stats
        setStats({
          activeJobs: activeJobsResult.count || 0,
          pendingJobs: applications?.filter(app => app.status === 'pending').length || 0,
          completedJobs: completedJobsResult.data?.length || 0,
          totalEarnings: completedJobsResult.data?.reduce((sum, job) => sum + (job.estimated_price || 0), 0) || 0,
        });
      }
      
      // availableJobsData already excludes jobs the driver has applied for
      console.log(`DriverScreen: Showing ${availableJobsData.length} jobs, with ${0} marked as applied`);
      setAvailableJobs(availableJobsData);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleStartShift = async () => {
    try {
      setIsAvailable(!isAvailable);
      // Update driver settings in the database
      await supabase
        .from('driver_settings')
        .upsert({
          driver_id: userProfile?.id,
          available_for_jobs: !isAvailable,
          updated_at: new Date().toISOString(),
        });
      
      Alert.alert(
        'Shift Status Updated', 
        isAvailable ? 'You are now offline and will not receive new job requests.' : 'You are now online and available for jobs!'
      );
    } catch (error) {
      console.error('Error updating shift status:', error);
      Alert.alert('Error', 'Failed to update shift status. Please try again.');
    }
  };

  const handleQuickApply = async (jobId: string) => {
    if (!userProfile?.id) {
      Alert.alert('Error', 'User not authenticated');
      return;
    }

    try {
      await ShipmentService.applyForShipment(jobId, userProfile.id);
      Alert.alert('Success', 'Application submitted successfully! You will be notified when the client makes a decision.');
      fetchDashboardData(); // Refresh data to show updated job lists
    } catch (error: any) {
      console.error('Error applying to job:', error);
      Alert.alert('Error', error.message || 'Failed to apply to job. Please try again.');
    }
  };

  const getDriverInitial = () => {
    if (userProfile?.first_name) {
      return userProfile.first_name.charAt(0).toUpperCase();
    }
    return 'D';
  };

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      {/* Header */}
      <View style={styles.header}>
        <View style={styles.headerContent}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{getDriverInitial()}</Text>
          </View>
          <View style={styles.headerInfo}>
            <Text style={styles.greeting}>Welcome back,</Text>
            <Text style={styles.driverName}>
              {userProfile?.first_name || 'Driver'}
            </Text>
          </View>
        </View>
        <TouchableOpacity style={styles.notificationButton}>
          <MaterialIcons name="notifications" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Card */}
        <View style={styles.statusCard}>
          <View style={styles.statusHeader}>
            <MaterialIcons 
              name={isAvailable ? "local-shipping" : "do-not-disturb"} 
              size={24} 
              color={isAvailable ? Colors.success : Colors.text.disabled} 
            />
            <Text style={styles.statusTitle}>
              {isAvailable ? 'Available for Deliveries' : 'Offline'}
            </Text>
          </View>
          <Text style={styles.statusSubtitle}>
            {isAvailable ? 'Ready to accept new shipments' : 'Not receiving new job requests'}
          </Text>
          <TouchableOpacity 
            style={[styles.shiftButton, !isAvailable && styles.shiftButtonOffline]}
            onPress={handleStartShift}
          >
            <MaterialIcons 
              name={isAvailable ? "pause" : "play-arrow"} 
              size={20} 
              color={Colors.text.inverse} 
            />
            <Text style={styles.shiftButtonText}>
              {isAvailable ? 'End Shift' : 'Start Shift'}
            </Text>
          </TouchableOpacity>
        </View>

        {/* Quick Stats */}
        <View style={styles.statsContainer}>
          <View style={styles.statCard}>
            <MaterialIcons name="assignment" size={32} color={Colors.primary} />
            <Text style={styles.statNumber}>{stats.activeJobs}</Text>
            <Text style={styles.statLabel}>Active Jobs</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="schedule" size={32} color={Colors.warning} />
            <Text style={styles.statNumber}>{availableJobs.length}</Text>
            <Text style={styles.statLabel}>Available</Text>
          </View>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={32} color={Colors.success} />
            <Text style={styles.statNumber}>{stats.completedJobs}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
        </View>

        {/* Available Shipments */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Available Jobs</Text>
            <TouchableOpacity onPress={() => navigation.navigate('AvailableShipments')}>
              <Text style={styles.viewAllText}>View All</Text>
            </TouchableOpacity>
          </View>
          
          {availableJobs.length > 0 ? (
            availableJobs.slice(0, 3).map((job) => (
              <View key={job.id} style={styles.jobCard}>
                <View style={styles.jobHeader}>
                  <Text style={styles.jobTitle}>{job.title || `Shipment #${job.id.substring(0, 8)}`}</Text>
                  <View style={styles.earningsBadge}>
                    <Text style={styles.earningsText}>${job.estimated_price || 0}</Text>
                  </View>
                </View>
                
                {job.hasApplied && (
                  <View style={styles.appliedBadge}>
                    <MaterialIcons name="check-circle" size={16} color={Colors.success} />
                    <Text style={styles.appliedText}>Applied</Text>
                  </View>
                )}
                
                <View style={styles.jobDetails}>
                  <View style={styles.jobDetailRow}>
                    <MaterialIcons name="location-on" size={16} color={Colors.primary} />
                    <Text style={styles.jobDetailText} numberOfLines={1}>
                      {job.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.jobDetailRow}>
                    <MaterialIcons name="flag" size={16} color={Colors.secondary} />
                    <Text style={styles.jobDetailText} numberOfLines={1}>
                      {job.delivery_address}
                    </Text>
                  </View>
                  {job.description && (
                    <View style={styles.jobDetailRow}>
                      <MaterialIcons name="info" size={16} color={Colors.text.secondary} />
                      <Text style={styles.jobDetailText} numberOfLines={2}>
                        {job.description}
                      </Text>
                    </View>
                  )}
                </View>
                
                <TouchableOpacity 
                  style={[styles.quickApplyButton, job.hasApplied && styles.quickApplyButtonDisabled]}
                  onPress={() => handleQuickApply(job.id)}
                  disabled={job.hasApplied}
                >
                  <Text style={[styles.quickApplyText, job.hasApplied && styles.quickApplyTextDisabled]}>
                    {job.hasApplied ? 'Applied' : 'Accept Job'}
                  </Text>
                </TouchableOpacity>
              </View>
            ))
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="inbox" size={48} color={Colors.text.disabled} />
              <Text style={styles.emptyTitle}>No jobs available</Text>
              <Text style={styles.emptySubtitle}>
                New delivery requests will appear here
              </Text>
            </View>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('MyShipments')}
          >
            <MaterialIcons name="route" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>View My Jobs</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Messages')}
          >
            <MaterialIcons name="chat" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Messages</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialIcons name="account-balance-wallet" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>View Payouts</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('AvailableShipments')}
          >
            <MaterialIcons name="search" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Browse Jobs</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.actionButton}
            onPress={() => navigation.navigate('Profile')}
          >
            <MaterialIcons name="settings" size={20} color={Colors.primary} />
            <Text style={styles.actionText}>Driver Settings</Text>
            <MaterialIcons name="chevron-right" size={20} color={Colors.text.secondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
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
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    fontSize: 20,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  headerInfo: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
    color: Colors.text.inverse,
    opacity: 0.8,
  },
  driverName: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.text.inverse,
  },
  notificationButton: {
    padding: 8,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
  },
  statusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 20,
    marginTop: 20,
    borderLeftWidth: 4,
    borderLeftColor: Colors.success,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 12,
  },
  statusSubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 36,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 20,
  },
  statCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    flex: 1,
    marginHorizontal: 4,
  },
  statNumber: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.text.primary,
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginTop: 4,
    textAlign: 'center',
  },
  section: {
    marginTop: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  emptyState: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 40,
    alignItems: 'center',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
  },
  emptySubtitle: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 8,
  },
  actionButton: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  actionText: {
    fontSize: 16,
    color: Colors.text.primary,
    marginLeft: 12,
    flex: 1,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  viewAllText: {
    fontSize: 14,
    color: Colors.primary,
    fontWeight: '600',
  },
  jobCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 2,
    },
    shadowOpacity: 0.1,
    shadowRadius: 3.84,
    elevation: 5,
  },
  jobHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  jobTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  earningsBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
  },
  earningsText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  jobDetails: {
    marginBottom: 12,
  },
  jobDetailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  jobDetailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
  },
  quickApplyButton: {
    backgroundColor: Colors.primary,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  quickApplyButtonDisabled: {
    backgroundColor: Colors.text.disabled,
  },
  quickApplyText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  quickApplyTextDisabled: {
    color: Colors.surface,
  },
  appliedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E8F5E8',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 6,
    marginBottom: 8,
    alignSelf: 'flex-start',
  },
  appliedText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.success,
    marginLeft: 4,
  },
  shiftButton: {
    backgroundColor: Colors.success,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flexDirection: 'row',
    alignItems: 'center',
  },
  shiftButtonOffline: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  shiftButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    marginLeft: 4,
  },
});
