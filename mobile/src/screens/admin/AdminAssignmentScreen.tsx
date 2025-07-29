import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
  ScrollView,
  Modal,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { Colors } from '../../constants/Colors';
import { ShipmentService } from '../../services/shipmentService';
import { getApiUrl } from '../../utils/environment';
import { ApplicationService } from '../../services/applicationService';

type AdminAssignmentScreenProps = NativeStackScreenProps<RootStackParamList, 'AdminAssignment'>;

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

export default function AdminAssignmentScreen({ navigation }: AdminAssignmentScreenProps) {
  const { userProfile } = useAuth();
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [availableDrivers, setAvailableDrivers] = useState<any[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string | null>(null);
  const [isDriverModalVisible, setIsDriverModalVisible] = useState(false);

  // Check if user is admin, redirect if not
  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      Alert.alert('Access Denied', 'You need admin privileges to access this screen.');
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

      console.log(`AdminScreen: Found ${pendingShipments?.length || 0} pending shipments`);
      
      if (!pendingShipments || pendingShipments.length === 0) {
        setShipments([]);
        return;
      }
      
      // Load all applications at once instead of one by one
      await loadAllApplicationsAtOnce(pendingShipments);
    } catch (err) {
      console.error('Error in loadPendingShipments:', err);
      Alert.alert('Error', 'An unexpected error occurred while loading shipments');
    } finally {
      setLoading(false);
    }
  };

  const loadAllApplicationsAtOnce = async (pendingShipments: any[]) => {
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
              'Authorization': `Bearer ${session.data.session.access_token}`,
              'Content-Type': 'application/json',
            },
          });

          if (response.ok) {
            const result = await response.json();
            if (result.success && result.data) {
              console.log(`AdminScreen: Successfully loaded ${result.data.length} applications from backend`);
              
              // Group applications by shipment_id
              const applicationsByShipment = result.data.reduce((acc: any, app: any) => {
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
                  driver: app.driver ? {
                    id: app.driver.id,
                    first_name: app.driver.first_name,
                    last_name: app.driver.last_name,
                    email: app.driver.email,
                    phone: app.driver.phone,
                    avatar_url: app.driver.avatar_url,
                    rating: app.driver.rating
                  } : undefined
                });
                return acc;
              }, {});

              // Initialize shipments with their applications
              const shipmentsWithApplications = pendingShipments.map(shipment => ({
                ...shipment,
                applications: applicationsByShipment[shipment.id] || [],
                expandedApplications: false
              }));

              setShipments(shipmentsWithApplications);
              console.log('AdminScreen: Successfully updated shipments with applications');
              return;
            }
          }
        }
      } catch (backendError) {
        console.log('AdminScreen: Backend endpoint failed, falling back to direct database queries');
      }

      // Fallback: Load applications using direct database queries (but more efficiently)
      console.log('AdminScreen: Loading applications via direct database queries...');
      
      const shipmentIds = pendingShipments.map(s => s.id);
      
      // Get all applications for all shipments in one query
      const { data: allApplications, error } = await supabase
        .from('job_applications')
        .select(`
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
        `)
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
            driver: profileData ? {
              id: profileData.id,
              first_name: profileData.first_name,
              last_name: profileData.last_name,
              email: profileData.email,
              phone: profileData.phone,
              avatar_url: profileData.avatar_url || undefined,
              rating: profileData.rating || undefined
            } : undefined
          });
        });
      }

      // Initialize shipments with their applications
      const shipmentsWithApplications = pendingShipments.map(shipment => ({
        ...shipment,
        applications: applicationsByShipment[shipment.id] || [],
        expandedApplications: false
      }));

      setShipments(shipmentsWithApplications);
      console.log(`AdminScreen: Loaded applications for ${Object.keys(applicationsByShipment).length} shipments`);
    } catch (err) {
      console.error('Error loading applications:', err);
      
      // Final fallback: Initialize shipments without applications
      const shipmentsWithoutApplications = pendingShipments.map(shipment => ({
        ...shipment,
        applications: [],
        expandedApplications: false
      }));
      setShipments(shipmentsWithoutApplications);
    }
  };

  const assignDriver = async (shipmentId: string, driverId: string) => {
    try {
      setLoading(true);
      
      // Update the shipment with the selected driver
      const result = await ShipmentService.assignDriverToShipment(shipmentId, driverId);
      
      if (!result) {
        Alert.alert('Error', 'Failed to assign driver to shipment');
        return;
      }

      Alert.alert('Success', 'Driver assigned successfully!');
      
      // Refresh the shipments list
      loadPendingShipments();
    } catch (err) {
      console.error('Error in assignDriver:', err);
      Alert.alert('Error', 'An unexpected error occurred while assigning driver');
    } finally {
      setLoading(false);
    }
  };

  const confirmAssignment = (shipmentId: string, driverId: string, driverName: string) => {
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

  const renderDriverItem = ({ item }: { item: any }) => (
    <TouchableOpacity 
      style={styles.driverModalItem}
      onPress={() => {
        setIsDriverModalVisible(false);
        if (selectedShipmentId) {
          confirmAssignment(
            selectedShipmentId, 
            item.id, 
            `${item.first_name} ${item.last_name}`
          );
        }
      }}
    >
      <View style={styles.driverAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name.charAt(0)}{item.last_name.charAt(0)}
        </Text>
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>{item.first_name} {item.last_name}</Text>
        {item.rating && (
          <View style={styles.ratingContainer}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <MaterialIcons name="arrow-forward-ios" size={16} color={Colors.text.secondary} />
    </TouchableOpacity>
  );

  const toggleApplications = (shipmentId: string) => {
    setShipments(prevShipments => 
      prevShipments.map(shipment => 
        shipment.id === shipmentId
          ? { ...shipment, expandedApplications: !shipment.expandedApplications }
          : shipment
      )
    );
  };

  const onRefresh = async () => {
    setRefreshing(true);
    await loadPendingShipments();
    setRefreshing(false);
  };

  const renderShipmentItem = ({ item }: { item: Shipment }) => {
    const hasApplications = item.applications && item.applications.length > 0;
    
    return (
      <View style={styles.shipmentCard}>
        <View style={styles.shipmentHeader}>
          <Text style={styles.shipmentTitle}>{item.title || `Shipment #${item.id.substring(0, 8)}`}</Text>
          <View style={styles.priceBadge}>
            <Text style={styles.priceText}>${item.estimated_price}</Text>
          </View>
        </View>
        
        <View style={styles.shipmentDetails}>
          <View style={styles.detailRow}>
            <MaterialIcons name="location-on" size={16} color={Colors.primary} />
            <Text style={styles.detailText}>{item.pickup_address}</Text>
          </View>
          <View style={styles.detailRow}>
            <MaterialIcons name="flag" size={16} color={Colors.secondary} />
            <Text style={styles.detailText}>{item.delivery_address}</Text>
          </View>
          {item.description && (
            <View style={styles.detailRow}>
              <MaterialIcons name="info" size={16} color={Colors.text.secondary} />
              <Text style={styles.detailText}>{item.description}</Text>
            </View>
          )}
          <View style={styles.detailRow}>
            <MaterialIcons name="event" size={16} color={Colors.text.secondary} />
            <Text style={styles.detailText}>
              {new Date(item.created_at).toLocaleDateString()} • Pending
            </Text>
          </View>
        </View>
        
        <View style={styles.applicantsSection}>
          <TouchableOpacity 
            style={styles.applicantsToggle}
            onPress={() => toggleApplications(item.id)}
          >
            <Text style={[
              styles.applicantsToggleText, 
              !hasApplications && styles.applicantsToggleTextDisabled
            ]}>
              {hasApplications 
                ? `${item.applications!.length} Driver Application${item.applications!.length !== 1 ? 's' : ''}` 
                : 'No Applications Yet'}
            </Text>
            <MaterialIcons 
              name={item.expandedApplications ? "expand-less" : "expand-more"} 
              size={24} 
              color={Colors.primary} 
            />
          </TouchableOpacity>
          
          {item.expandedApplications && (
            <View style={styles.applicantsList}>
              {hasApplications ? (
                (() => {
                  // Filter pending applications to show first
                  const pendingApplications = item.applications!.filter(app => app.status === 'pending');
                  const otherApplications = item.applications!.filter(app => app.status !== 'pending');
                  
                  console.log(`AdminScreen: Rendering ${pendingApplications.length} pending and ${otherApplications.length} other applications for shipment ${item.id}`);
                  
                  // Combine arrays with pending first
                  const sortedApplications = [...pendingApplications, ...otherApplications];
                  
                  return sortedApplications.map(application => (
                  <View key={application.id} style={styles.applicantItem}>
                    <View style={styles.applicantInfo}>
                      <View style={styles.applicantAvatar}>
                        {application.driver?.avatar_url ? (
                          <Text>Avatar</Text> // Replace with actual Avatar component if available
                        ) : (
                          <Text style={styles.avatarText}>
                            {application.driver?.first_name?.charAt(0).toUpperCase() || 'D'}
                          </Text>
                        )}
                      </View>
                      <View style={styles.applicantDetails}>
                        <Text style={styles.applicantName}>
                          {application.driver 
                            ? `${application.driver.first_name} ${application.driver.last_name}`
                            : `Driver ID: ${application.driver_id.substring(0, 8)}...`}
                        </Text>
                        <View style={styles.statusRow}>
                          <Text style={styles.applicantMeta}>
                            Applied: {new Date(application.applied_at).toLocaleDateString()}
                          </Text>
                          <View style={[
                            styles.statusBadge, 
                            { backgroundColor: application.status === 'pending' ? Colors.warning : Colors.text.disabled }
                          ]}>
                            <Text style={styles.statusText}>{application.status}</Text>
                          </View>
                        </View>
                        {application.driver?.rating && (
                          <View style={styles.ratingContainer}>
                            <MaterialIcons name="star" size={16} color="#FFD700" />
                            <Text style={styles.ratingText}>{application.driver.rating.toFixed(1)}</Text>
                          </View>
                        )}
                      </View>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.assignButton,
                        application.status !== 'pending' && styles.disabledButton
                      ]}
                      onPress={() => confirmAssignment(
                        item.id,
                        application.driver_id,
                        application.driver 
                          ? `${application.driver.first_name} ${application.driver.last_name}`
                          : `Driver ID: ${application.driver_id.substring(0, 8)}...`
                      )}
                      disabled={application.status !== 'pending'}
                    >
                      <Text style={styles.assignButtonText}>Assign</Text>
                    </TouchableOpacity>
                  </View>
                  ));
                })()
              ) : (
                <View style={styles.noApplicationsContainer}>
                  <MaterialIcons name="person-search" size={48} color={Colors.text.disabled} />
                  <Text style={styles.noApplicationsText}>
                    No driver applications yet.
                  </Text>
                  <Text style={styles.noApplicationsSubText}>
                    Drivers will appear here once they apply for this shipment.
                  </Text>
                  <TouchableOpacity
                    style={styles.quickAssignButton}
                    onPress={() => openQuickAssignModal(item.id)}
                  >
                    <MaterialIcons name="person-add" size={20} color="#FFFFFF" />
                    <Text style={styles.quickAssignButtonText}>Quick Assign</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )}
        </View>
      </View>
    );
  };

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
      
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Driver Assignment</Text>
      </View>
      
      <FlatList
        data={shipments}
        renderItem={renderShipmentItem}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            colors={[Colors.primary]}
          />
        }
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={64} color={Colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Pending Shipments</Text>
            <Text style={styles.emptyText}>
              There are currently no shipments pending driver assignment.
            </Text>
          </View>
        }
      />
      
      {/* Driver Selection Modal */}
      <Modal
        visible={isDriverModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setIsDriverModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select a Driver</Text>
              <TouchableOpacity 
                onPress={() => setIsDriverModalVisible(false)}
                style={styles.closeButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.text.primary} />
              </TouchableOpacity>
            </View>
            
            <FlatList
              data={availableDrivers}
              renderItem={renderDriverItem}
              keyExtractor={item => item.id}
              contentContainerStyle={styles.driversList}
              ListEmptyComponent={
                <View style={styles.noDriversContainer}>
                  <Text style={styles.noDriversText}>No drivers available</Text>
                </View>
              }
            />
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    backgroundColor: Colors.primary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 20,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#FFFFFF',
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
  },
  listContent: {
    padding: 16,
  },
  shipmentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  shipmentHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  shipmentTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  priceBadge: {
    backgroundColor: Colors.success,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 6,
  },
  priceText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#FFFFFF',
  },
  shipmentDetails: {
    marginBottom: 16,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  detailText: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 8,
    flex: 1,
  },
  applicantsSection: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    paddingTop: 12,
  },
  applicantsToggle: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  applicantsToggleText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
  applicantsToggleTextDisabled: {
    color: Colors.text.disabled,
  },
  applicantsList: {
    marginTop: 8,
  },
  applicantItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  applicantInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  applicantAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  applicantDetails: {
    flex: 1,
  },
  applicantName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  applicantMeta: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    marginLeft: 4,
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  assignButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
  },
  assignButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
  },
  emptyContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 2,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    color: '#FFFFFF',
    fontWeight: '500',
  },
  disabledButton: {
    backgroundColor: Colors.text.disabled,
  },
  noApplicationsContainer: {
    padding: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    margin: 8,
  },
  noApplicationsText: {
    fontSize: 16,
    fontWeight: '500',
    color: Colors.text.secondary,
    textAlign: 'center',
    marginTop: 12,
    marginBottom: 4,
  },
  noApplicationsSubText: {
    fontSize: 14,
    color: Colors.text.disabled,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  quickAssignButton: {
    backgroundColor: Colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 6,
    marginTop: 16,
  },
  quickAssignButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 14,
    marginLeft: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    height: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
  },
  closeButton: {
    padding: 4,
  },
  driversList: {
    padding: 16,
  },
  driverModalItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  driverAvatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  noDriversContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDriversText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
});
