import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { Colors } from '../../constants/Colors';

type AdminDashboardScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminDashboard'
>;

interface DashboardStats {
  pendingShipments: number;
  activeShipments: number;
  completedShipments: number;
  pendingApplications: number;
  totalDrivers: number;
  totalClients: number;
}

export default function AdminDashboardScreen({
  navigation,
}: AdminDashboardScreenProps) {
  const { userProfile } = useAuth();
  const [stats, setStats] = useState<DashboardStats>({
    pendingShipments: 0,
    activeShipments: 0,
    completedShipments: 0,
    pendingApplications: 0,
    totalDrivers: 0,
    totalClients: 0,
  });
  const [loading, setLoading] = useState(true);

  // Check if user is admin, redirect if not
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      Alert.alert(
        'Access Denied',
        'You need admin privileges to access this screen.'
      );
      navigation.goBack();
    }
  }, [userProfile, navigation]);

  // Load dashboard stats on mount
  useEffect(() => {
    loadDashboardStats();
  }, []);

  const loadDashboardStats = async () => {
    try {
      setLoading(true);

      // Get pending shipments count
      const { count: pendingShipments, error: pendingError } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending')
        .is('driver_id', null);

      if (pendingError) {
        console.error('Error fetching pending shipments:', pendingError);
      }

      // Get active shipments count
      const { count: activeShipments, error: activeError } = await supabase
        .from('shipments')
        .select('*', { count: 'exact', head: true })
        .in('status', ['accepted', 'picked_up', 'in_transit']);

      if (activeError) {
        console.error('Error fetching active shipments:', activeError);
      }

      // Get completed shipments count
      const { count: completedShipments, error: completedError } =
        await supabase
          .from('shipments')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'delivered');

      if (completedError) {
        console.error('Error fetching completed shipments:', completedError);
      }

      // Get pending applications count
      const { count: pendingApplications, error: applicationsError } =
        await supabase
          .from('job_applications')
          .select('*', { count: 'exact', head: true })
          .eq('status', 'pending');

      if (applicationsError) {
        console.error(
          'Error fetching pending applications:',
          applicationsError
        );
      }

      // Get total drivers count
      const { count: totalDrivers, error: driversError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'driver');

      if (driversError) {
        console.error('Error fetching total drivers:', driversError);
      }

      // Get total clients count
      const { count: totalClients, error: clientsError } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .eq('role', 'client');

      if (clientsError) {
        console.error('Error fetching total clients:', clientsError);
      }

      // Update stats with the values we got, defaulting to 0 for any that failed
      setStats({
        pendingShipments: pendingShipments || 0,
        activeShipments: activeShipments || 0,
        completedShipments: completedShipments || 0,
        pendingApplications: pendingApplications || 0,
        totalDrivers: totalDrivers || 0,
        totalClients: totalClients || 0,
      });
    } catch (err) {
      console.error('Error in loadDashboardStats:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred while loading dashboard'
      );
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading dashboard...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Admin Dashboard</Text>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.statsContainer}>
          <Text style={styles.sectionTitle}>Shipment Overview</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pendingShipments}</Text>
              <Text style={styles.statLabel}>Pending</Text>
              <MaterialIcons
                name="pending-actions"
                size={24}
                color={Colors.warning}
              />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.activeShipments}</Text>
              <Text style={styles.statLabel}>Active</Text>
              <MaterialIcons
                name="local-shipping"
                size={24}
                color={Colors.success}
              />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.completedShipments}</Text>
              <Text style={styles.statLabel}>Completed</Text>
              <MaterialIcons
                name="check-circle"
                size={24}
                color={Colors.success}
              />
            </View>
          </View>

          <Text style={styles.sectionTitle}>User Statistics</Text>
          <View style={styles.statsRow}>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalDrivers}</Text>
              <Text style={styles.statLabel}>Drivers</Text>
              <MaterialIcons
                name="drive-eta"
                size={24}
                color={Colors.primary}
              />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.totalClients}</Text>
              <Text style={styles.statLabel}>Clients</Text>
              <MaterialIcons name="people" size={24} color={Colors.primary} />
            </View>
            <View style={styles.statCard}>
              <Text style={styles.statValue}>{stats.pendingApplications}</Text>
              <Text style={styles.statLabel}>Applications</Text>
              <MaterialIcons
                name="person-add"
                size={24}
                color={Colors.warning}
              />
            </View>
          </View>
        </View>

        <View style={styles.actionContainer}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          <View style={styles.actionButtonsContainer}>
            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('AdminAssignment')}
            >
              <MaterialIcons name="assignment" size={32} color={Colors.white} />
              <Text style={styles.actionButtonText}>Assign Drivers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => navigation.navigate('ClientTabs')}  // Navigate to client tabs, then to Shipments
            >
              <MaterialIcons name="view-list" size={32} color={Colors.white} />
              <Text style={styles.actionButtonText}>Manage Shipments</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => alert('Manage Drivers - Feature coming soon')}
            >
              <MaterialIcons name="group" size={32} color={Colors.white} />
              <Text style={styles.actionButtonText}>Manage Drivers</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.actionButton}
              onPress={() => alert('Driver Applications - Feature coming soon')}
            >
              <MaterialIcons
                name="assignment-ind"
                size={32}
                color={Colors.white}
              />
              <Text style={styles.actionButtonText}>Driver Applications</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={styles.refreshButton}
          onPress={loadDashboardStats}
        >
          <MaterialIcons name="refresh" size={20} color={Colors.white} />
          <Text style={styles.refreshButtonText}>Refresh Dashboard</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loaderContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: Colors.text.primary,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 15,
    paddingHorizontal: 20,
    borderBottomLeftRadius: 20,
    borderBottomRightRadius: 20,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.white,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    marginVertical: 12,
    color: Colors.text.primary,
  },
  statsContainer: {
    marginBottom: 20,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 15,
  },
  statCard: {
    backgroundColor: Colors.white,
    borderRadius: 12,
    padding: 15,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 5,
  },
  statLabel: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 8,
  },
  actionContainer: {
    marginBottom: 30,
  },
  actionButtonsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  actionButton: {
    backgroundColor: Colors.primary,
    width: '48%',
    borderRadius: 12,
    padding: 20,
    alignItems: 'center',
    marginBottom: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  actionButtonText: {
    color: Colors.white,
    marginTop: 10,
    fontWeight: '600',
  },
  refreshButton: {
    backgroundColor: Colors.primary,
    borderRadius: 25,
    paddingVertical: 12,
    paddingHorizontal: 20,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 30,
    alignSelf: 'center',
  },
  refreshButtonText: {
    color: Colors.white,
    marginLeft: 8,
    fontWeight: '600',
  },
});
