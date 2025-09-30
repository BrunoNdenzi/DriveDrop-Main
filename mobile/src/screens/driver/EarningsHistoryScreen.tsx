import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import { Colors } from '../../constants/Colors';

interface EarningsData {
  id: string;
  shipment_id: string;
  amount: number;
  date: string;
  status: string;
  pickup_address: string;
  delivery_address: string;
  distance: number;
  duration: number;
  payment_method: string;
}

interface EarningsSummary {
  today: number;
  thisWeek: number;
  thisMonth: number;
  total: number;
  completedTrips: number;
  averagePerTrip: number;
}

const FILTER_OPTIONS = [
  { label: 'All Time', value: 'all' },
  { label: 'This Month', value: 'month' },
  { label: 'This Week', value: 'week' },
  { label: 'Today', value: 'today' },
];

export default function EarningsHistoryScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [showFilterModal, setShowFilterModal] = useState(false);
  const [selectedFilter, setSelectedFilter] = useState('all');
  const [earningsData, setEarningsData] = useState<EarningsData[]>([]);
  const [summary, setSummary] = useState<EarningsSummary>({
    today: 0,
    thisWeek: 0,
    thisMonth: 0,
    total: 0,
    completedTrips: 0,
    averagePerTrip: 0,
  });

  useEffect(() => {
    fetchEarningsData();
  }, [selectedFilter]);

  const fetchEarningsData = async () => {
    if (!userProfile) return;

    try {
      setLoading(true);

      // Get date range based on filter
      const now = new Date();
      let dateFilter = '';

      switch (selectedFilter) {
        case 'today':
          const today = now.toISOString().split('T')[0];
          dateFilter = `AND created_at >= '${today}'`;
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          dateFilter = `AND created_at >= '${weekAgo.toISOString()}'`;
          break;
        case 'month':
          const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
          dateFilter = `AND created_at >= '${monthAgo.toISOString()}'`;
          break;
        default:
          dateFilter = '';
      }

      // Fetch earnings data from completed shipments
      const { data: shipmentsData, error: shipmentsError } = await (supabase as any)
        .from('shipments')
        .select(`
          id,
          estimated_price,
          final_price,
          status,
          pickup_address,
          delivery_address,
          distance,
          duration,
          payment_method,
          created_at,
          completed_at
        `)
        .eq('driver_id', userProfile.id)
        .eq('status', 'completed')
        .order('completed_at', { ascending: false });

      if (shipmentsError) {
        throw shipmentsError;
      }

      // Transform shipments data to earnings data
      const earnings: EarningsData[] = (shipmentsData || []).map((shipment: any) => ({
        id: shipment.id,
        shipment_id: shipment.id,
        amount: Math.round((shipment.final_price || shipment.estimated_price || 0) * 0.9), // 90% of the price
        date: shipment.completed_at || shipment.created_at,
        status: 'completed',
        pickup_address: shipment.pickup_address || 'Unknown',
        delivery_address: shipment.delivery_address || 'Unknown',
        distance: shipment.distance || 0,
        duration: shipment.duration || 0,
        payment_method: shipment.payment_method || 'card',
      }));

      // Filter earnings based on selected filter
      let filteredEarnings = earnings;
      if (selectedFilter !== 'all') {
        const now = new Date();
        filteredEarnings = earnings.filter(earning => {
          const earningDate = new Date(earning.date);
          switch (selectedFilter) {
            case 'today':
              return earningDate.toDateString() === now.toDateString();
            case 'week':
              const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
              return earningDate >= weekAgo;
            case 'month':
              const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
              return earningDate >= monthAgo;
            default:
              return true;
          }
        });
      }

      setEarningsData(filteredEarnings);

      // Calculate summary
      const totalEarnings = earnings.reduce((sum, earning) => sum + earning.amount, 0);
      const todayEarnings = earnings
        .filter(earning => new Date(earning.date).toDateString() === now.toDateString())
        .reduce((sum, earning) => sum + earning.amount, 0);
      
      const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      const weekEarnings = earnings
        .filter(earning => new Date(earning.date) >= weekAgo)
        .reduce((sum, earning) => sum + earning.amount, 0);
      
      const monthAgo = new Date(now.getFullYear(), now.getMonth(), 1);
      const monthEarnings = earnings
        .filter(earning => new Date(earning.date) >= monthAgo)
        .reduce((sum, earning) => sum + earning.amount, 0);

      setSummary({
        today: todayEarnings,
        thisWeek: weekEarnings,
        thisMonth: monthEarnings,
        total: totalEarnings,
        completedTrips: earnings.length,
        averagePerTrip: earnings.length > 0 ? totalEarnings / earnings.length : 0,
      });

    } catch (error) {
      console.error('Error fetching earnings data:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    fetchEarningsData();
  };

  const formatCurrency = (amount: number) => {
    return amount.toLocaleString('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    });
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays === 1) return 'Today';
    if (diffDays === 2) return 'Yesterday';
    if (diffDays <= 7) return `${diffDays - 1} days ago`;

    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
    });
  };

  const formatDistance = (distance: number) => {
    if (distance < 1) {
      return `${(distance * 1000).toFixed(0)}m`;
    }
    return `${distance.toFixed(1)} miles`;
  };

  const formatDuration = (duration: number) => {
    const hours = Math.floor(duration / 60);
    const minutes = duration % 60;
    if (hours > 0) {
      return `${hours}h ${minutes}m`;
    }
    return `${minutes}m`;
  };

  const getPaymentMethodIcon = (method: string) => {
    switch (method.toLowerCase()) {
      case 'cash':
        return 'money';
      case 'card':
      case 'credit_card':
        return 'credit-card';
      case 'digital_wallet':
        return 'account-balance-wallet';
      default:
        return 'payment';
    }
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading earnings history...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Earnings History</Text>
        <TouchableOpacity
          style={styles.filterButton}
          onPress={() => setShowFilterModal(true)}
        >
          <MaterialIcons name="filter-list" size={24} color={Colors.text.inverse} />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Summary Cards */}
        <View style={styles.summaryContainer}>
          <View style={styles.summaryCard}>
            <Text style={styles.summaryAmount}>{formatCurrency(summary.total)}</Text>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
          </View>
          
          <View style={styles.summaryRow}>
            <View style={styles.summaryMiniCard}>
              <Text style={styles.summaryMiniAmount}>{formatCurrency(summary.thisMonth)}</Text>
              <Text style={styles.summaryMiniLabel}>This Month</Text>
            </View>
            <View style={styles.summaryMiniCard}>
              <Text style={styles.summaryMiniAmount}>{formatCurrency(summary.thisWeek)}</Text>
              <Text style={styles.summaryMiniLabel}>This Week</Text>
            </View>
          </View>

          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{summary.completedTrips}</Text>
              <Text style={styles.statLabel}>Total Trips</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statItem}>
              <Text style={styles.statValue}>{formatCurrency(summary.averagePerTrip)}</Text>
              <Text style={styles.statLabel}>Avg Per Trip</Text>
            </View>
          </View>
        </View>

        {/* Filter Info */}
        <View style={styles.filterInfo}>
          <Text style={styles.filterText}>
            Showing {FILTER_OPTIONS.find(opt => opt.value === selectedFilter)?.label} • {earningsData.length} trips
          </Text>
        </View>

        {/* Earnings List */}
        {earningsData.length === 0 ? (
          <View style={styles.emptyContainer}>
            <MaterialIcons name="account-balance-wallet" size={64} color={Colors.text.disabled} />
            <Text style={styles.emptyTitle}>No Earnings Yet</Text>
            <Text style={styles.emptySubtitle}>
              Complete your first shipment to start earning!
            </Text>
          </View>
        ) : (
          <View style={styles.earningsList}>
            {earningsData.map((earning) => (
              <TouchableOpacity key={earning.id} style={styles.earningItem}>
                <View style={styles.earningHeader}>
                  <View style={styles.earningInfo}>
                    <Text style={styles.earningAmount}>{formatCurrency(earning.amount)}</Text>
                    <Text style={styles.earningDate}>{formatDate(earning.date)}</Text>
                  </View>
                  <View style={styles.paymentMethod}>
                    <MaterialIcons
                      name={getPaymentMethodIcon(earning.payment_method)}
                      size={20}
                      color={Colors.primary}
                    />
                  </View>
                </View>

                <View style={styles.earningDetails}>
                  <View style={styles.addressContainer}>
                    <MaterialIcons name="my-location" size={14} color={Colors.text.secondary} />
                    <Text style={styles.address} numberOfLines={1}>
                      {earning.pickup_address}
                    </Text>
                  </View>
                  <View style={styles.addressContainer}>
                    <MaterialIcons name="place" size={14} color={Colors.text.secondary} />
                    <Text style={styles.address} numberOfLines={1}>
                      {earning.delivery_address}
                    </Text>
                  </View>
                </View>

                <View style={styles.tripMetrics}>
                  <View style={styles.metric}>
                    <MaterialIcons name="straighten" size={14} color={Colors.text.secondary} />
                    <Text style={styles.metricText}>{formatDistance(earning.distance)}</Text>
                  </View>
                  <View style={styles.metric}>
                    <MaterialIcons name="schedule" size={14} color={Colors.text.secondary} />
                    <Text style={styles.metricText}>{formatDuration(earning.duration)}</Text>
                  </View>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Bottom padding */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Filter Modal */}
      <Modal
        visible={showFilterModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFilterModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Filter Earnings</Text>
              <TouchableOpacity
                onPress={() => setShowFilterModal(false)}
                style={styles.modalCloseButton}
              >
                <MaterialIcons name="close" size={24} color={Colors.text.secondary} />
              </TouchableOpacity>
            </View>
            <View style={styles.modalList}>
              {FILTER_OPTIONS.map((option) => (
                <TouchableOpacity
                  key={option.value}
                  style={[
                    styles.modalOption,
                    selectedFilter === option.value && styles.modalOptionSelected,
                  ]}
                  onPress={() => {
                    setSelectedFilter(option.value);
                    setShowFilterModal(false);
                  }}
                >
                  <Text
                    style={[
                      styles.modalOptionText,
                      selectedFilter === option.value && styles.modalOptionTextSelected,
                    ]}
                  >
                    {option.label}
                  </Text>
                  {selectedFilter === option.value && (
                    <MaterialIcons name="check" size={20} color={Colors.primary} />
                  )}
                </TouchableOpacity>
              ))}
            </View>
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
    backgroundColor: Colors.secondary,
    paddingTop: 60,
    paddingBottom: 20,
    paddingHorizontal: 24,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  filterButton: {
    padding: 4,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  summaryContainer: {
    marginBottom: 24,
  },
  summaryCard: {
    backgroundColor: Colors.primary,
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  summaryAmount: {
    fontSize: 32,
    fontWeight: 'bold',
    color: Colors.text.inverse,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 16,
    color: Colors.text.inverse,
    opacity: 0.9,
  },
  summaryRow: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 12,
  },
  summaryMiniCard: {
    flex: 1,
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  summaryMiniAmount: {
    fontSize: 18,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  summaryMiniLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statsRow: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  statItem: {
    flex: 1,
    alignItems: 'center',
  },
  statValue: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  statLabel: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  statDivider: {
    width: 1,
    backgroundColor: Colors.border,
    marginHorizontal: 16,
  },
  filterInfo: {
    backgroundColor: Colors.surface,
    borderRadius: 8,
    padding: 12,
    marginBottom: 16,
    alignItems: 'center',
  },
  filterText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 48,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  earningsList: {
    gap: 12,
  },
  earningItem: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  earningHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  earningInfo: {},
  earningAmount: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.primary,
    marginBottom: 2,
  },
  earningDate: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  paymentMethod: {
    backgroundColor: Colors.primary + '15',
    borderRadius: 20,
    padding: 8,
  },
  earningDetails: {
    marginBottom: 12,
    gap: 4,
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  address: {
    fontSize: 14,
    color: Colors.text.primary,
    flex: 1,
  },
  tripMetrics: {
    flexDirection: 'row',
    gap: 16,
  },
  metric: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metricText: {
    fontSize: 12,
    color: Colors.text.secondary,
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
    color: Colors.text.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  modalCloseButton: {
    padding: 4,
  },
  modalList: {},
  modalOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalOptionSelected: {
    backgroundColor: Colors.primary + '10',
  },
  modalOptionText: {
    fontSize: 16,
    color: Colors.text.primary,
  },
  modalOptionTextSelected: {
    color: Colors.primary,
    fontWeight: '600',
  },
});
