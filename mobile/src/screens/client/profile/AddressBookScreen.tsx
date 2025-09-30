import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Modal,
  TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../context/AuthContext';

interface Address {
  id: string;
  label: string;
  street_address: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_default: boolean;
  is_pickup_location: boolean;
  is_delivery_location: boolean;
  contact_name?: string;
  contact_phone?: string;
  special_instructions?: string;
}

export default function AddressBookScreen({ navigation }: any) {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<Address[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingAddress, setEditingAddress] = useState<Address | null>(null);
  const [formData, setFormData] = useState({
    label: '',
    street_address: '',
    city: '',
    state: '',
    zip_code: '',
    country: 'United States',
    contact_name: '',
    contact_phone: '',
    special_instructions: '',
    is_pickup_location: true,
    is_delivery_location: true,
  });

  useEffect(() => {
    fetchAddresses();
  }, []);

  const fetchAddresses = async () => {
    if (!user?.id) return;
    
    try {
      const { data, error } = await (supabase as any)
        .from('client_addresses')
        .select('*')
        .eq('client_id', user.id)
        .order('is_default', { ascending: false });

      if (error) throw error;
      setAddresses(data || []);
    } catch (error) {
      console.error('Error fetching addresses:', error);
      Alert.alert('Error', 'Failed to load addresses');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setFormData({
      label: '',
      street_address: '',
      city: '',
      state: '',
      zip_code: '',
      country: 'United States',
      contact_name: '',
      contact_phone: '',
      special_instructions: '',
      is_pickup_location: true,
      is_delivery_location: true,
    });
    setEditingAddress(null);
  };

  const openAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };

  const openEditModal = (address: Address) => {
    setFormData({
      label: address.label,
      street_address: address.street_address,
      city: address.city,
      state: address.state,
      zip_code: address.zip_code,
      country: address.country,
      contact_name: address.contact_name || '',
      contact_phone: address.contact_phone || '',
      special_instructions: address.special_instructions || '',
      is_pickup_location: address.is_pickup_location,
      is_delivery_location: address.is_delivery_location,
    });
    setEditingAddress(address);
    setShowAddModal(true);
  };

  const saveAddress = async () => {
    if (!formData.label || !formData.street_address || !formData.city || !formData.state || !formData.zip_code) {
      Alert.alert('Error', 'Please fill in all required fields');
      return;
    }

    try {
      const addressData = {
        ...formData,
        client_id: user?.id,
        contact_name: formData.contact_name || null,
        contact_phone: formData.contact_phone || null,
        special_instructions: formData.special_instructions || null,
      };

      if (editingAddress) {
        const { error } = await (supabase as any)
          .from('client_addresses')
          .update(addressData)
          .eq('id', editingAddress.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from('client_addresses')
          .insert([addressData]);

        if (error) throw error;
      }

      fetchAddresses();
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error('Error saving address:', error);
      Alert.alert('Error', 'Failed to save address');
    }
  };

  const setAsDefault = async (addressId: string) => {
    if (!user?.id) return;
    
    try {
      // First, remove default from all addresses
      await (supabase as any)
        .from('client_addresses')
        .update({ is_default: false })
        .eq('client_id', user.id);

      // Then set the selected address as default
      const { error } = await (supabase as any)
        .from('client_addresses')
        .update({ is_default: true })
        .eq('id', addressId);

      if (error) throw error;
      
      fetchAddresses();
      Alert.alert('Success', 'Default address updated');
    } catch (error) {
      console.error('Error updating default address:', error);
      Alert.alert('Error', 'Failed to update default address');
    }
  };

  const deleteAddress = async (addressId: string) => {
    Alert.alert(
      'Delete Address',
      'Are you sure you want to delete this address?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              const { error } = await supabase
                .from('client_addresses')
                .delete()
                .eq('id', addressId);

              if (error) throw error;
              fetchAddresses();
            } catch (error) {
              console.error('Error deleting address:', error);
              Alert.alert('Error', 'Failed to delete address');
            }
          },
        },
      ]
    );
  };

  const getAddressIcon = (label: string) => {
    const lowercaseLabel = label.toLowerCase();
    if (lowercaseLabel.includes('home')) return 'home';
    if (lowercaseLabel.includes('work') || lowercaseLabel.includes('office')) return 'business';
    if (lowercaseLabel.includes('warehouse')) return 'storefront';
    return 'location';
  };

  if (loading) {
    return (
      <View style={[styles.container, styles.centered]}>
        <ActivityIndicator size="large" color="#007AFF" />
        <Text style={styles.loadingText}>Loading addresses...</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {addresses.length === 0 ? (
          <View style={styles.emptyState}>
            <Ionicons name="location-outline" size={64} color="#999" />
            <Text style={styles.emptyTitle}>No Saved Addresses</Text>
            <Text style={styles.emptySubtitle}>
              Add addresses to make booking shipments faster and easier
            </Text>
          </View>
        ) : (
          <View style={styles.addressesList}>
            {addresses.map((address) => (
              <View key={address.id} style={styles.addressCard}>
                <View style={styles.addressHeader}>
                  <View style={styles.addressInfo}>
                    <Ionicons
                      name={getAddressIcon(address.label)}
                      size={24}
                      color="#007AFF"
                      style={styles.addressIcon}
                    />
                    <View style={styles.addressDetails}>
                      <Text style={styles.addressLabel}>{address.label}</Text>
                      <Text style={styles.addressText}>
                        {address.street_address}
                      </Text>
                      <Text style={styles.addressText}>
                        {address.city}, {address.state} {address.zip_code}
                      </Text>
                      {address.contact_name && (
                        <Text style={styles.contactText}>
                          Contact: {address.contact_name}
                        </Text>
                      )}
                      <View style={styles.addressBadges}>
                        {address.is_default && (
                          <Text style={styles.defaultBadge}>Default</Text>
                        )}
                        {address.is_pickup_location && (
                          <Text style={styles.typeBadge}>Pickup</Text>
                        )}
                        {address.is_delivery_location && (
                          <Text style={styles.typeBadge}>Delivery</Text>
                        )}
                      </View>
                    </View>
                  </View>
                  <TouchableOpacity
                    style={styles.menuButton}
                    onPress={() => {
                      Alert.alert(
                        'Address Options',
                        address.label,
                        [
                          { text: 'Cancel', style: 'cancel' },
                          {
                            text: 'Edit',
                            onPress: () => openEditModal(address),
                          },
                          !address.is_default && {
                            text: 'Set as Default',
                            onPress: () => setAsDefault(address.id),
                          },
                          {
                            text: 'Delete',
                            style: 'destructive',
                            onPress: () => deleteAddress(address.id),
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

        <TouchableOpacity style={styles.addButton} onPress={openAddModal}>
          <Ionicons name="add-circle" size={24} color="#007AFF" />
          <Text style={styles.addButtonText}>Add New Address</Text>
        </TouchableOpacity>
      </ScrollView>

      {/* Add/Edit Address Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              onPress={() => setShowAddModal(false)}
              style={styles.modalButton}
            >
              <Text style={styles.modalButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>
              {editingAddress ? 'Edit Address' : 'Add Address'}
            </Text>
            <TouchableOpacity onPress={saveAddress} style={styles.modalButton}>
              <Text style={[styles.modalButtonText, styles.saveButton]}>Save</Text>
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalContent}>
            <View style={styles.formGroup}>
              <Text style={styles.label}>Label *</Text>
              <TextInput
                style={styles.input}
                value={formData.label}
                onChangeText={(text) => setFormData({ ...formData, label: text })}
                placeholder="e.g., Home, Work, Warehouse"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Street Address *</Text>
              <TextInput
                style={styles.input}
                value={formData.street_address}
                onChangeText={(text) => setFormData({ ...formData, street_address: text })}
                placeholder="Enter street address"
              />
            </View>

            <View style={styles.formRow}>
              <View style={[styles.formGroup, styles.flex1]}>
                <Text style={styles.label}>City *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.city}
                  onChangeText={(text) => setFormData({ ...formData, city: text })}
                  placeholder="City"
                />
              </View>
              <View style={[styles.formGroup, styles.flex1, styles.marginLeft]}>
                <Text style={styles.label}>State *</Text>
                <TextInput
                  style={styles.input}
                  value={formData.state}
                  onChangeText={(text) => setFormData({ ...formData, state: text })}
                  placeholder="State"
                />
              </View>
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>ZIP Code *</Text>
              <TextInput
                style={styles.input}
                value={formData.zip_code}
                onChangeText={(text) => setFormData({ ...formData, zip_code: text })}
                placeholder="ZIP Code"
                keyboardType="numeric"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Name</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_name}
                onChangeText={(text) => setFormData({ ...formData, contact_name: text })}
                placeholder="Contact person at this address"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Contact Phone</Text>
              <TextInput
                style={styles.input}
                value={formData.contact_phone}
                onChangeText={(text) => setFormData({ ...formData, contact_phone: text })}
                placeholder="Contact phone number"
                keyboardType="phone-pad"
              />
            </View>

            <View style={styles.formGroup}>
              <Text style={styles.label}>Special Instructions</Text>
              <TextInput
                style={[styles.input, styles.textArea]}
                value={formData.special_instructions}
                onChangeText={(text) => setFormData({ ...formData, special_instructions: text })}
                placeholder="Any special delivery instructions"
                multiline
                numberOfLines={3}
              />
            </View>

            <View style={styles.checkboxGroup}>
              <Text style={styles.label}>Address Type</Text>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setFormData({ ...formData, is_pickup_location: !formData.is_pickup_location })}
              >
                <Ionicons
                  name={formData.is_pickup_location ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.checkboxText}>Can be used for pickup</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.checkbox}
                onPress={() => setFormData({ ...formData, is_delivery_location: !formData.is_delivery_location })}
              >
                <Ionicons
                  name={formData.is_delivery_location ? 'checkbox' : 'square-outline'}
                  size={24}
                  color="#007AFF"
                />
                <Text style={styles.checkboxText}>Can be used for delivery</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </Modal>
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
  addressesList: {
    padding: 16,
  },
  addressCard: {
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
  addressHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  addressInfo: {
    flexDirection: 'row',
    flex: 1,
  },
  addressIcon: {
    marginRight: 12,
    marginTop: 2,
  },
  addressDetails: {
    flex: 1,
  },
  addressLabel: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    marginBottom: 4,
  },
  addressText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 2,
  },
  contactText: {
    fontSize: 14,
    color: '#007AFF',
    marginTop: 4,
    marginBottom: 8,
  },
  addressBadges: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  defaultBadge: {
    fontSize: 12,
    color: '#28a745',
    fontWeight: '600',
    backgroundColor: '#e8f5e8',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
  },
  typeBadge: {
    fontSize: 12,
    color: '#007AFF',
    fontWeight: '500',
    backgroundColor: '#e8f4ff',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
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
  modalContainer: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e9ecef',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
  },
  modalButton: {
    minWidth: 60,
  },
  modalButtonText: {
    fontSize: 16,
    color: '#007AFF',
  },
  saveButton: {
    fontWeight: '600',
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  formGroup: {
    marginBottom: 20,
  },
  formRow: {
    flexDirection: 'row',
  },
  flex1: {
    flex: 1,
  },
  marginLeft: {
    marginLeft: 12,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  input: {
    backgroundColor: '#fff',
    borderWidth: 1,
    borderColor: '#e9ecef',
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    color: '#333',
  },
  textArea: {
    height: 80,
    textAlignVertical: 'top',
  },
  checkboxGroup: {
    marginBottom: 20,
  },
  checkbox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  checkboxText: {
    fontSize: 16,
    color: '#333',
    marginLeft: 12,
  },
});