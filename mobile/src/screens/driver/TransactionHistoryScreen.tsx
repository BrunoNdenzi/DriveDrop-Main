import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  Text,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../../constants/Colors';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../context/AuthContext';

interface Transaction {
  id: string;
  title: string;
  pickup_address: string;
  delivery_address: string;
  estimated_price: number;
  actual_earnings: number;
  commission: number;
  status: string;
  created_at: string;
  delivered_at?: string;
  customer_name: string;
}

export default function TransactionHistoryScreen({ navigation }: any) {
  const { userProfile } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [totalEarnings, setTotalEarnings] = useState(0);
  const [totalCommission, setTotalCommission] = useState(0);

  useEffect(() => {
    fetchTransactions();
  }, []);

  const fetchTransactions = async () => {
    if (!userProfile?.id) return;

    try {
      setLoading(true);

      // Fetch completed/delivered shipments with customer info
      const { data, error } = await supabase
        .from('shipments')
        .select(`
          id,
          title,
          pickup_address,
          delivery_address,
          estimated_price,
          status,
          created_at,
          updated_at,
          profiles:client_id(first_name, last_name)
        `)
        .eq('driver_id', userProfile.id)
        .in('status', ['delivered', 'completed'])
        .order('updated_at', { ascending: false });

      if (error) throw error;

      // Transform data and calculate earnings (90% to driver, 10% commission)
      const transformedTransactions: Transaction[] = (data || []).map((shipment: any) => {
        const price = shipment.estimated_price || 0;
        const commission = price * 0.10; // 10% commission
        const earnings = price * 0.90; // 90% to driver

        return {
          id: shipment.id,
          title: shipment.title || 'Delivery Service',
          pickup_address: shipment.pickup_address || 'Unknown pickup',
          delivery_address: shipment.delivery_address || 'Unknown delivery',
          estimated_price: price,
          actual_earnings: earnings,
          commission: commission,
          status: shipment.status,
          created_at: shipment.created_at,
          delivered_at: shipment.updated_at,
          customer_name: shipment.profiles
            ? `${shipment.profiles.first_name} ${shipment.profiles.last_name}`
            : 'Unknown Customer',
        };
      });

      // Calculate totals
      const total = transformedTransactions.reduce((sum, t) => sum + t.actual_earnings, 0);
      const totalComm = transformedTransactions.reduce((sum, t) => sum + t.commission, 0);

      setTransactions(transformedTransactions);
      setTotalEarnings(total);
      setTotalCommission(totalComm);
    } catch (error) {
      console.error('Error fetching transactions:', error);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    fetchTransactions();
  };

  const formatCurrency = (amount: number) => {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const renderTransaction = ({ item }: { item: Transaction }) => (
    <View style={styles.transactionCard}>
      <View style={styles.transactionHeader}>
        <View style={styles.transactionTitleContainer}>
          <MaterialIcons name="local-shipping" size={20} color={Colors.success} />
          <Text style={styles.transactionTitle}>{item.title}</Text>
        </View>
        <Text style={styles.earningsAmount}>{formatCurrency(item.actual_earnings)}</Text>
      </View>

      <View style={styles.transactionDetails}>
        <View style={styles.customerRow}>
          <MaterialIcons name="person" size={16} color={Colors.text.secondary} />
          <Text style={styles.customerName}>{item.customer_name}</Text>
        </View>

        <View style={styles.locationRow}>
          <MaterialIcons name="location-on" size={16} color={Colors.secondary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.pickup_address}
          </Text>
        </View>

        <View style={styles.locationRow}>
          <MaterialIcons name="place" size={16} color={Colors.primary} />
          <Text style={styles.locationText} numberOfLines={1}>
            {item.delivery_address}
          </Text>
        </View>

        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Shipment Value:</Text>
          <Text style={styles.breakdownValue}>{formatCurrency(item.estimated_price)}</Text>
        </View>
        <View style={styles.breakdownRow}>
          <Text style={styles.breakdownLabel}>Commission (10%):</Text>
          <Text style={styles.breakdownValueNegative}>-{formatCurrency(item.commission)}</Text>
        </View>
        <View style={[styles.breakdownRow, styles.totalRow]}>
          <Text style={styles.breakdownLabelBold}>Your Earnings (90%):</Text>
          <Text style={styles.breakdownValueBold}>{formatCurrency(item.actual_earnings)}</Text>
        </View>

        <View style={styles.dateRow}>
          <MaterialIcons name="schedule" size={14} color={Colors.text.disabled} />
          <Text style={styles.dateText}>
            {item.delivered_at ? formatDate(item.delivered_at) : formatDate(item.created_at)}
          </Text>
        </View>
      </View>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading transactions...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="light" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFF" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Transaction History</Text>
        <View style={styles.placeholder} />
      </View>

      {/* Summary Card */}
      <View style={styles.summaryCard}>
        <View style={styles.summaryRow}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Earnings</Text>
            <Text style={styles.summaryAmount}>{formatCurrency(totalEarnings)}</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryLabel}>Total Deliveries</Text>
            <Text style={styles.summaryAmount}>{transactions.length}</Text>
          </View>
        </View>
        <View style={styles.commissionRow}>
          <MaterialIcons name="info-outline" size={16} color="#1976D2" />
          <Text style={styles.commissionText}>
            Total commission paid: {formatCurrency(totalCommission)}
          </Text>
        </View>
      </View>

      {/* Transactions List */}
      {transactions.length === 0 ? (
        <View style={styles.emptyContainer}>
          <MaterialIcons name="receipt-long" size={64} color={Colors.text.disabled} />
          <Text style={styles.emptyText}>No transactions yet</Text>
          <Text style={styles.emptySubtext}>
            Complete deliveries to see your transaction history
          </Text>
        </View>
      ) : (
        <FlatList
          data={transactions}
          renderItem={renderTransaction}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              colors={[Colors.primary]}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
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
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.primary,
    paddingTop: 50,
    paddingBottom: 16,
    paddingHorizontal: 16,
  },
  backButton: {
    padding: 8,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFF',
  },
  placeholder: {
    width: 40,
  },
  summaryCard: {
    backgroundColor: Colors.surface,
    margin: 16,
    padding: 16,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    alignItems: 'center',
    marginBottom: 12,
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryDivider: {
    width: 1,
    height: 40,
    backgroundColor: Colors.border,
  },
  summaryLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginBottom: 4,
  },
  summaryAmount: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.success,
  },
  commissionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  commissionText: {
    fontSize: 12,
    color: '#1976D2',
    marginLeft: 6,
  },
  listContent: {
    padding: 16,
    paddingTop: 0,
  },
  transactionCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  transactionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  transactionTitleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  transactionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginLeft: 8,
  },
  earningsAmount: {
    fontSize: 18,
    fontWeight: '700',
    color: Colors.success,
  },
  transactionDetails: {
    gap: 8,
  },
  customerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  customerName: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginLeft: 6,
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  locationText: {
    fontSize: 13,
    color: Colors.text.secondary,
    marginLeft: 6,
    flex: 1,
  },
  breakdownRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 4,
  },
  breakdownLabel: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  breakdownValue: {
    fontSize: 13,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  breakdownValueNegative: {
    fontSize: 13,
    color: Colors.error,
    fontWeight: '500',
  },
  totalRow: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginTop: 4,
    paddingTop: 8,
  },
  breakdownLabelBold: {
    fontSize: 14,
    color: Colors.text.primary,
    fontWeight: '600',
  },
  breakdownValueBold: {
    fontSize: 14,
    color: Colors.success,
    fontWeight: '700',
  },
  dateRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dateText: {
    fontSize: 12,
    color: Colors.text.disabled,
    marginLeft: 4,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    paddingHorizontal: 32,
  },
});
