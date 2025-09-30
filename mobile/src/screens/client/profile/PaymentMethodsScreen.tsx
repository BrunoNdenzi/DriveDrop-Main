import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface PaymentMethod {
  id: string;
  payment_type: 'credit_card' | 'debit_card' | 'bank_account' | 'paypal';
  last_four: string;
  card_brand?: string;
  expiry_month?: number;
  expiry_year?: number;
  is_default: boolean;
}

export default function PaymentMethodsScreen({ navigation }: any) {
  const { user } = useAuth();
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPaymentMethods();
  }, []);

  const fetchPaymentMethods = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('client_payment_methods')
        .select('*')
        .eq('client_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setPaymentMethods(data || []);
    } catch (error) {
      console.error('Error fetching payment methods:', error);
      Alert.alert('Error', 'Failed to load payment methods');
    } finally {
      setLoading(false);
    }
  };

  const setAsDefault = async (methodId: string) => {
    if (!user?.id) return;
    
    try {
      // First, remove default from all methods
      await (supabase as any)
        .from('client_payment_methods')
        .update({ is_default: false })
        .eq('client_id', user.id);

      // Then set the selected method as default
      const { error } = await (supabase as any)
        .from('client_payment_methods')
        .update({ is_default: true })
        .eq('id', methodId);

      if (error) throw error;
      
      fetchPaymentMethods();
      Alert.alert('Success', 'Default payment method updated');
    } catch (error) {
      console.error('Error updating default payment method:', error);
      Alert.alert('Error', 'Failed to update default payment method');
    }
  };

  const deletePaymentMethod = async (methodId: string) => {
    Alert.alert(
      'Delete Payment Method',
      'Are you sure you want to delete this payment method?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('client_payment_methods')
                .delete()
                .eq('id', methodId);

              if (error) throw error;
              fetchPaymentMethods();
            } catch (error) {
              console.error('Error deleting payment method:', error);
              Alert.alert('Error', 'Failed to delete payment method');
            }
          },
        },
      ]
    );
  };

  const getPaymentIcon = (type: string, brand?: string) => {
    switch (type) {
      case 'credit_card':
      case 'debit_card':
        return brand === 'visa' ? 'card' : brand === 'mastercard' ? 'card' : 'card-outline';
      case 'bank_account':
        return 'business-outline';
      case 'paypal':
        return 'logo-paypal';
      default:
        return 'card-outline';
    }
  };

  const formatPaymentMethod = (method: PaymentMethod) => {
    switch (method.payment_type) {
      case 'credit_card':
      case 'debit_card':
        return `${method.card_brand?.toUpperCase() || 'Card'} ending in ${method.last_four}`;
      case 'bank_account':
        return `Bank account ending in ${method.last_four}`;
      case 'paypal':
        return 'PayPal Account';
      default:
        return `Payment method ending in ${method.last_four}`;
    }
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading payment methods...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {paymentMethods.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="card-outline" size={64} color="#999" />
            <Text style={styles.emptyTitle}>No Payment Methods</Text>
            <Text style={styles.emptySubtitle}>
              Add a payment method to make bookings easier
            </Text>
          </View>
        ) : (
          <View style={styles.methodsList}>
            {paymentMethods.map((method) => (
              <View key={method.id} style={styles.methodCard}>
                <View style={styles.methodHeader}>
                  <View style={styles.methodInfo}>
                    <Ionicons
                      name={getPaymentIcon(method.payment_type, method.card_brand)}
                      size={24}
                      color="#007AFF"
                      style={styles.methodIcon}
                    />
                    <View style={styles.methodDetails}>
                      <Text style={styles.methodType}>
                        {formatPaymentMethod(method)}
                      </Text>
                      {method.expiry_month && method.expiry_year && (
                        <Text style={styles.methodExpiry}>
                          Expires {String(method.expiry_month).padStart(2, '0')}/{method.expiry_year}
                        </Text>
                      )}
                      {method.is_default && (
                        <Text style={styles.defaultBadge}>Default</Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => {
                      Alert.alert(
                        'Payment Method Options',
                        formatPaymentMethod(method),
                        [
                          { text: 'Cancel', style: 'cancel' },
                          !method.is_default && {
                            text: 'Set as Default',
                            onPress: () => setAsDefault(method.id),
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deletePaymentMethod(method.id),
                          },
                        ].filter(Boolean) as any
                      );
                    }}
                  >
                    <Ionicons name="ellipsis-vertical" size={20} color="#666" />
                  </TouchableOpacity>
                </View>
              </View>
            ))}
          </View>
        )}

        <TouchableOpacity
          style={styles.addButton}
          onPress={() => {
            Alert.alert(
              'Add Payment Method',
              'This feature would integrate with a payment processor like Stripe to securely add payment methods.',
              [{ text: 'OK' }]
            );
          }}
        >
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.addButtonText}>Add Payment Method</Text>
        </TouchableOpacity>

        <View style={styles.securityInfo}>
          <Ionicons name="shield-checkmark" size={20} color="#28a745" />
          <Text style={styles.securityText}>
            Your payment information is encrypted and secure
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: '#666',
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: 32,
  },
  emptyTitle: {
    fontSize: 24,
    fontWeight: '600',
    color: '#333',
    marginTop: 16,
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 16,
    color: '#666',
    textAlign: 'center',
    lineHeight: 22,
  },
  methodsList: {
    padding: 16,
  },
  methodCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  methodHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  methodInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  methodIcon: {
    marginRight: 12,
  },
  methodDetails: {
    flex: 1,
  },
  methodType: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  methodExpiry: {
    fontSize: 14,
    color: '#666',
    marginBottom: 4,
  },
  defaultBadge: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    alignSelf: 'flex-start',
  },
  menuButton: {
    padding: 8,
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#fff',
    margin: 16,
    padding: 16,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#007AFF',
    borderStyle: 'dashed',
  },
  addButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#007AFF',
    marginLeft: 8,
  },
  securityInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    paddingBottom: 32,
  },
  securityText: {
    fontSize: 14,
    color: '#28a745',
    marginLeft: 8,
    fontWeight: '500',
  },
});