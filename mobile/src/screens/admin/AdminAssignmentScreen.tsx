import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { Colors } from '../../constants/Colors';
import { ShipmentService } from '../../services/shipmentService';
import { getApiUrl } from '../../utils/environment';
import AdminAssignmentHeader from "../../components/AdminAssignmentHeader";
import ShipmentList from '../../components/ShipmentList';
import DriverSelectionModal from '../../components/DriverSelectionModal';

type AdminAssignmentScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'AdminAssignment'
>;

// Define the types needed for our data
interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
}

interface Application {
  id: string;
  driver_id: string;
  shipment_id: string;
  status: 'pending' | 'accepted' | 'rejected';
  applied_at: string;
  updated_at: string | null;
  driver?: Driver;
}

interface Shipment {
  id: string;
  title: string;
  description?: string;
  pickup_address: string;
  delivery_address: string;
  status: string;
  created_at: string;
  client_id: string;
  driver_id: string | null;
  estimated_price: number;
  applications?: Application[];
  expandedApplications?: boolean;
}

export default function AdminAssignmentScreen({
  navigation,
}: AdminAssignmentScreenProps) {
  const { userProfile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(
    null
  );
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);

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

  // Load pending shipments on mount
  useEffect(() => {
    loadPendingShipments();
    loadAvailableDrivers();
  }, []);

  const loadAvailableDrivers = async () => {
    try {
      const drivers = await ShipmentService.getAllAvailableDrivers();
      setAvailableDrivers(drivers);
    } catch (error) {
      console.error('Error loading available drivers:', error);
      Alert.alert('Error', 'Failed to load available drivers');
    }
  };

  const loadPendingShipments = async () => {
    try {
      setLoading(true);
      console.log('AdminScreen: Loading pending shipments...');

      // Get pending shipments that don't have a driver assigned
      const { data: pendingShipments, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('status', 'pending')
        .is('driver_id', null)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Error fetching pending shipments:', error);
        Alert.alert('Error', 'Failed to load pending shipments');
        return;
      }

      console.log(
        `AdminScreen: Found ${pendingShipments?.length || 0} pending shipments`
      );

      if (!pendingShipments || pendingShipments.length === 0) {
        setShipments([]);
        return;
      }

      // Load all applications at once instead of one by one
      await loadAllApplicationsAtOnce(pendingShipments);
    } catch (err) {
      console.error('Error in loadPendingShipments:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred while loading shipments'
      );
    } finally {
      setLoading(false);
    }
  };

  const loadAllApplicationsAtOnce = async (pendingShipments: Shipment[]) => {
    try {
      // First try to use the new backend endpoint for all applications
      try {
        const session = await supabase.auth.getSession();
        if (session.data.session?.access_token) {
          console.log('AdminScreen: Fetching all applications from backend...');

          const apiUrl = getApiUrl();
          const response = await fetch(`${apiUrl}/api/v1/applications`, {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              console.log(
                `AdminScreen: Successfully loaded ${result.data.length} applications from backend`
              );

              // Group applications by shipment_id
              const applicationsByShipment = result.data.reduce(
                (acc: Record<string, Application[]>, app: Application) => {
                  if (!acc[app.shipment_id]) {
                    acc[app.shipment_id] = [];
                  }
                  acc[app.shipment_id].push({
                    id: app.id,
                    driver_id: app.driver_id,
                    shipment_id: app.shipment_id,
                    status: app.status,
                    applied_at: app.applied_at,
                    updated_at: app.updated_at,
                    driver: app.driver
                      ? {
                          id: app.driver.id,
                          first_name: app.driver.first_name,
                          last_name: app.driver.last_name,
                          email: app.driver.email,
                          phone: app.driver.phone,
                          avatar_url: app.driver.avatar_url,
                          rating: app.driver.rating,
                        }
                      : undefined,
                  });
                  return acc;
                },
                {}
              );

              // Initialize shipments with their applications
              const shipmentsWithApplications = pendingShipments.map(
                shipment => ({
                  ...shipment,
                  applications: applicationsByShipment[shipment.id] || [],
                  expandedApplications: false,
                })
              );

              setShipments(shipmentsWithApplications);
              console.log(
                'AdminScreen: Successfully updated shipments with applications'
              );
              return;
            }
          }
        }
        console.log(
          'AdminScreen: Backend endpoint failed, falling back to direct database queries'
        );
      } catch {
        console.log('AdminScreen: Backend API call failed, using fallback');
      }

      // Fallback: Load applications using direct database queries (but more efficiently)
      console.log(
        'AdminScreen: Loading applications via direct database queries...'
      );

      const shipmentIds = pendingShipments.map(s => s.id);

      // Get all applications for all shipments in one query
      const { data: allApplications, error } = await supabase
        .from('job_applications')
        .select(
          `
          id, 
          shipment_id, 
          driver_id, 
          status, 
          applied_at, 
          responded_at,
          updated_at,
          profiles:driver_id (
            id, 
            first_name, 
            last_name, 
            email, 
            phone, 
            avatar_url, 
            rating
          )
        `
        )
        .in('shipment_id', shipmentIds);

      // Group applications by shipment
      const applicationsByShipment: { [key: string]: Application[] } = {};

      if (!error && allApplications) {
        allApplications.forEach(app => {
          if (!applicationsByShipment[app.shipment_id]) {
            applicationsByShipment[app.shipment_id] = [];
          }

          const profileData = app.profiles as any;
          applicationsByShipment[app.shipment_id].push({
            id: app.id,
            driver_id: app.driver_id,
            shipment_id: app.shipment_id,
            status: app.status as 'pending' | 'accepted' | 'rejected',
            applied_at: app.applied_at,
            updated_at: app.updated_at || app.responded_at || null,
            driver: profileData
              ? {
                  id: profileData.id,
                  first_name: profileData.first_name,
                  last_name: profileData.last_name,
                  email: profileData.email,
                  phone: profileData.phone,
                  avatar_url: profileData.avatar_url || undefined,
                  rating: profileData.rating || undefined,
                }
              : undefined,
          });
        });
      }

      // Initialize shipments with their applications
      const shipmentsWithApplications = pendingShipments.map(shipment => ({
        ...shipment,
        applications: applicationsByShipment[shipment.id] || [],
        expandedApplications: false,
      }));

      setShipments(shipmentsWithApplications);
      console.log(
        `AdminScreen: Loaded applications for ${Object.keys(applicationsByShipment).length} shipments`
      );
    } catch (err) {
      console.error('Error loading applications:', err);

      // Final fallback: Initialize shipments without applications
      const shipmentsWithoutApplications = pendingShipments.map(shipment => ({
        ...shipment,
        applications: [],
        expandedApplications: false,
      }));
      setShipments(shipmentsWithoutApplications);
    }
  };

  const assignDriver = async (shipmentId: string, driverId: string) => {
    try {
      setLoading(true);

      // Update the shipment with the selected driver
      const result = await ShipmentService.assignDriverToShipment(
        shipmentId,
        driverId
      );

      if (!result) {
        Alert.alert('Error', 'Failed to assign driver to shipment');
        return;
      }

      Alert.alert('Success', 'Driver assigned successfully!');

      // Refresh the shipments list
      loadPendingShipments();
    } catch (err) {
      console.error('Error in assignDriver:', err);
      Alert.alert(
        'Error',
        'An unexpected error occurred while assigning driver'
      );
    } finally {
      setLoading(false);
    }
  };

  const confirmAssignment = (
    shipmentId: string,
    driverId: string,
    driverName: string
  ) => {
    Alert.alert(
      'Confirm Assignment',
      `Are you sure you want to assign ${driverName} to this shipment?`,
      [
        {
          text: 'Cancel',
          style: 'cancel',
        },
        {
          text: 'Assign',
          onPress: () => assignDriver(shipmentId, driverId),
        },
      ]
    );
  };

  const openQuickAssignModal = (shipmentId: string) => {
    setSelectedShipmentId(shipmentId);
    setIsDriverModalVisible(true);
  };

  // renderDriverItem removed and moved to DriverSelectionModal component

  const toggleApplications = (shipmentId: string) => {
    setShipments(prevShipments =>
      prevShipments.map(shipment =>
        shipment.id === shipmentId
          ? {
              ...shipment,
              expandedApplications: !shipment.expandedApplications,
            }
          : shipment
      )
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingShipments();
    setRefreshing(false);
  };

  // renderShipmentItem removed and moved to ShipmentList component

  if (loading && !refreshing) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shipments...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      <AdminAssignmentHeader
        title="Assignments"
        onBack={() => navigation.goBack()}
      />

      <ShipmentList
        shipments={shipments}
        refreshing={refreshing}
        onRefresh={onRefresh}
        onToggleApplications={toggleApplications}
        onConfirmAssignment={confirmAssignment}
        onOpenQuickAssignModal={openQuickAssignModal}
      />

      <DriverSelectionModal
        isVisible={isDriverModalVisible}
        drivers={availableDrivers}
        selectedShipmentId={selectedShipmentId}
        onClose={() => setIsDriverModalVisible(false)}
        onSelectDriver={(driverId, driverName) => {
          if (selectedShipmentId) {
            confirmAssignment(selectedShipmentId, driverId, driverName);
          }
        }}
      />
    </View>
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
    marginTop: 16,
    fontSize: 16,
    color: Colors.text.secondary,
  }
});


