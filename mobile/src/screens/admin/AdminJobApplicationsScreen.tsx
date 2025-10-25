import React, { useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  RefreshControl,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';
import { RootStackParamList } from '../../navigation/types';
import { Colors } from '../../constants/Colors';

type Props = NativeStackScreenProps<RootStackParamList, 'AdminJobApplications'>;

interface JobApplication {
  id: string;
  shipment_id: string;
  driver_id: string;
  status: string;
  applied_at: string;
  responded_at: string | null;
  notes: string | null;
  driver_profile: {
    first_name: string;
    last_name: string;
    email: string;
    phone: string | null;
  };
  shipment: {
    title: string;
    pickup_address: string;
    delivery_address: string;
    estimated_price: number;
    status: string;
  };
}

export default function AdminJobApplicationsScreen({ navigation }: Props): JSX.Element {
  const { userProfile } = useAuth();
  const [applications, setApplications] = useState<JobApplication[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('pending');

  useEffect(() => {
    if (userProfile && userProfile.role !== 'admin') {
      Alert.alert('Access Denied', 'You need admin privileges to access this screen.');
      navigation.goBack();
    }
  }, [userProfile, navigation]);

  useEffect(() => {
    loadApplications();
  }, [filter]);

  const loadApplications = async () => {
    try {
      setLoading(true);
      
      let query = supabase
        .from('job_applications')
        .select(`
          *,
          driver_profile:driver_id (
            first_name,
            last_name,
            email,
            phone
          ),
          shipment:shipment_id (
            title,
            pickup_address,
            delivery_address,
            estimated_price,
            status
          )
        `)
        .order('applied_at', { ascending: false });

      if (filter !== 'all') {
        query = query.eq('status', filter);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching job applications:', error);
        throw error;
      }

      console.log(`Loaded ${data?.length || 0} job applications with filter: ${filter}`);
      setApplications((data || []) as JobApplication[]);
    } catch (error: any) {
      console.error('Error in loadApplications:', error);
      Alert.alert('Error', error.message || 'Failed to load job applications');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadApplications();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const updateStatus = async (applicationId: string, newStatus: 'accepted' | 'rejected') => {
    try {
      // Use the stored procedure to update application status
      // This automatically handles:
      // 1. Updating the application status
      // 2. If accepted: assigns driver to shipment (status: 'assigned')
      // 3. If accepted: rejects all other pending applications for the same shipment
      // 4. Creates tracking events
      const { data, error } = await supabase.rpc('update_application_status', {
        p_application_id: applicationId,
        p_status: newStatus,
        p_notes: newStatus === 'accepted' 
          ? 'Application accepted by admin' 
          : 'Application rejected by admin'
      });

      if (error) {
        console.error('Error updating application status:', error);
        throw error;
      }

      console.log('Application status updated successfully:', data);
      Alert.alert('Success', `Application ${newStatus} successfully`);
      
      // Reload applications to reflect changes
      loadApplications();
    } catch (error: any) {
      console.error('Error updating application:', error);
      Alert.alert('Error', error.message || 'Failed to update application');
    }
  };

  const confirmUpdate = (id: string, driver: string, title: string, status: 'accepted' | 'rejected') => {
    Alert.alert(
      `${status === 'accepted' ? 'Accept' : 'Reject'} Application`,
      `${status === 'accepted' ? 'Accept' : 'Reject'} ${driver}'s application for "${title}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: status === 'accepted' ? 'Accept' : 'Reject',
          style: status === 'accepted' ? 'default' : 'destructive',
          onPress: () => updateStatus(id, status),
        },
      ]
    );
  };

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading applications...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />
      
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Driver Applications</Text>
        <View style={styles.placeholder} />
      </View>

      <View style={styles.filterContainer}>
        {(['all', 'pending', 'accepted', 'rejected'] as const).map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterButton, filter === f && styles.filterButtonActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterButtonText, filter === f && styles.filterButtonTextActive]}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[Colors.primary]} />
        }
      >
        {applications.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="assignment" size={64} color={Colors.text.disabled} />
            <Text style={styles.emptyText}>No {filter !== 'all' ? filter : ''} applications found</Text>
            <Text style={styles.emptySubtext}>
              {filter === 'pending' ? 'Driver job applications will appear here' : 'Processed applications will appear here'}
            </Text>
          </View>
        ) : (
          <>
            <Text style={styles.countText}>
              {applications.length} {filter !== 'all' ? filter : ''} application{applications.length !== 1 ? 's' : ''}
            </Text>
            {applications.map((app) => {
              const driverName = `${app.driver_profile.first_name} ${app.driver_profile.last_name}`;
              const shipmentTitle = app.shipment.title || 'Untitled Shipment';
              
              return (
                <View key={app.id} style={styles.card}>
                  <View style={styles.cardHeader}>
                    <View style={styles.driverInfo}>
                      <Text style={styles.driverName}>{driverName}</Text>
                      <Text style={styles.shipmentTitle}>Applied for: {shipmentTitle}</Text>
                    </View>
                    <View style={[styles.badge, { backgroundColor: app.status === 'pending' ? Colors.warning : app.status === 'accepted' ? Colors.success : Colors.error }]}>
                      <Text style={styles.badgeText}>{app.status.toUpperCase()}</Text>
                    </View>
                  </View>

                  <View style={styles.divider} />

                  <View style={styles.details}>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="person" size={18} color={Colors.primary} />
                      <Text style={styles.detailLabel}>Email:</Text>
                      <Text style={styles.detailValue}>{app.driver_profile.email}</Text>
                    </View>

                    {app.driver_profile.phone && (
                      <View style={styles.detailRow}>
                        <MaterialIcons name="phone" size={18} color={Colors.primary} />
                        <Text style={styles.detailLabel}>Phone:</Text>
                        <Text style={styles.detailValue}>{app.driver_profile.phone}</Text>
                      </View>
                    )}

                    <View style={styles.detailRow}>
                      <MaterialIcons name="location-on" size={18} color={Colors.primary} />
                      <Text style={styles.detailLabel}>From:</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{app.shipment.pickup_address}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <MaterialIcons name="place" size={18} color={Colors.primary} />
                      <Text style={styles.detailLabel}>To:</Text>
                      <Text style={styles.detailValue} numberOfLines={1}>{app.shipment.delivery_address}</Text>
                    </View>

                    <View style={styles.detailRow}>
                      <MaterialIcons name="attach-money" size={18} color={Colors.primary} />
                      <Text style={styles.detailLabel}>Price:</Text>
                      <Text style={styles.detailValue}>{formatCurrency(app.shipment.estimated_price || 0)}</Text>
                    </View>

                    <View style={styles.dateRow}>
                      <Text style={styles.dateLabel}>Applied:</Text>
                      <Text style={styles.dateValue}>
                        {new Date(app.applied_at).toLocaleDateString()} at {new Date(app.applied_at).toLocaleTimeString()}
                      </Text>
                    </View>
                  </View>

                  {app.status === 'pending' && (
                    <View style={styles.actions}>
                      <TouchableOpacity
                        style={[styles.button, styles.acceptButton]}
                        onPress={() => confirmUpdate(app.id, driverName, shipmentTitle, 'accepted')}
                      >
                        <MaterialIcons name="check-circle" size={18} color="#FFF" />
                        <Text style={styles.buttonText}>Accept</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.button, styles.rejectButton]}
                        onPress={() => confirmUpdate(app.id, driverName, shipmentTitle, 'rejected')}
                      >
                        <MaterialIcons name="cancel" size={18} color="#FFF" />
                        <Text style={styles.buttonText}>Reject</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </View>
              );
            })}
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  loaderContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: Colors.background },
  loadingText: { marginTop: 12, fontSize: 16, color: Colors.text.secondary },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: Colors.primary, paddingTop: 50, paddingBottom: 16, paddingHorizontal: 16 },
  backButton: { padding: 8 },
  headerTitle: { fontSize: 20, fontWeight: '700', color: '#FFF' },
  placeholder: { width: 40 },
  filterContainer: { flexDirection: 'row', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: Colors.surface, borderBottomWidth: 1, borderBottomColor: Colors.border },
  filterButton: { flex: 1, paddingVertical: 8, paddingHorizontal: 8, marginHorizontal: 4, borderRadius: 8, backgroundColor: Colors.background, alignItems: 'center' },
  filterButtonActive: { backgroundColor: Colors.primary },
  filterButtonText: { fontSize: 13, fontWeight: '600', color: Colors.text.secondary },
  filterButtonTextActive: { color: '#FFF' },
  content: { flex: 1, padding: 16 },
  countText: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary, marginBottom: 12 },
  card: { backgroundColor: Colors.surface, borderRadius: 12, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, elevation: 3 },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  driverInfo: { flex: 1 },
  driverName: { fontSize: 18, fontWeight: '700', color: Colors.text.primary, marginBottom: 4 },
  shipmentTitle: { fontSize: 14, color: Colors.text.secondary, fontStyle: 'italic' },
  badge: { flexDirection: 'row', alignItems: 'center', paddingVertical: 4, paddingHorizontal: 8, borderRadius: 12 },
  badgeText: { fontSize: 12, fontWeight: '700', color: '#FFF' },
  divider: { height: 1, backgroundColor: Colors.border, marginVertical: 12 },
  details: { marginBottom: 12 },
  detailRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  detailLabel: { fontSize: 14, fontWeight: '600', color: Colors.text.secondary, marginLeft: 8, marginRight: 8 },
  detailValue: { flex: 1, fontSize: 14, color: Colors.text.primary },
  dateRow: { flexDirection: 'row', alignItems: 'center', marginTop: 8, paddingTop: 8, borderTopWidth: 1, borderTopColor: Colors.border },
  dateLabel: { fontSize: 12, fontWeight: '600', color: Colors.text.secondary, marginRight: 8 },
  dateValue: { fontSize: 12, color: Colors.text.secondary },
  actions: { flexDirection: 'row', marginTop: 12, gap: 12 },
  button: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 8 },
  acceptButton: { backgroundColor: Colors.success },
  rejectButton: { backgroundColor: Colors.error },
  buttonText: { fontSize: 16, fontWeight: '600', color: '#FFF', marginLeft: 8 },
  emptyContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 60 },
  emptyText: { fontSize: 18, fontWeight: '600', color: Colors.text.primary, marginTop: 16, marginBottom: 8 },
  emptySubtext: { fontSize: 14, color: Colors.text.secondary, textAlign: 'center', paddingHorizontal: 32 },
});
