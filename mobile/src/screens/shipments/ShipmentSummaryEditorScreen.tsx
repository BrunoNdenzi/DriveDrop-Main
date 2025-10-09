import React, { useState, useEffect, useCallback } from 'react';
import {
  StyleSheet,
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { StatusBar } from 'expo-status-bar';
import { MaterialIcons } from '@expo/vector-icons';
import { format } from 'date-fns';

import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';
import { useAuth } from '../../context/AuthContext';
import { supabase } from '../../lib/supabase';
import {
  InlineTextEditor,
  InlineAddressEditor,
  InlineVehicleEditor,
  InlineDateEditor,
  InlineStatusEditor,
  InlinePricingDisplay,
} from '../../components';
import { pricingService } from '../../services/pricingService';

// Interface for shipment updates
interface ShipmentUpdate {
  [key: string]: any;
  updated_at?: string;
}

type ShipmentSummaryEditorScreenProps = NativeStackScreenProps<
  RootStackParamList,
  'ShipmentEditor'
>;

interface ShipmentData {
  id: string;
  tracking_number: string;
  status: string;
  client_id: string;
  pickup_address: string;
  delivery_address: string;
  pickup_city?: string;
  pickup_state?: string;
  pickup_zip?: string;
  delivery_city?: string;
  delivery_state?: string;
  delivery_zip?: string;
  vehicle_type?: string;
  vehicle_make?: string;
  vehicle_model?: string;
  vehicle_year?: number;
  vehicle_color?: string;
  vehicle_license_plate?: string;
  pickup_date?: string;
  delivery_date?: string;
  pickup_notes?: string;
  delivery_notes?: string;
  special_instructions?: string;
  estimated_price?: number;
  distance_miles?: number;
  is_accident_recovery?: boolean;
  created_at: string;
  updated_at: string;
}

export default function ShipmentSummaryEditorScreen({
  route,
  navigation,
}: ShipmentSummaryEditorScreenProps) {
  const { shipmentId } = route.params;
  const { userProfile } = useAuth();
  const [shipment, setShipment] = useState<ShipmentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  useEffect(() => {
    loadShipmentData();
  }, [shipmentId]);

  const loadShipmentData = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('shipments')
        .select('*')
        .eq('id', shipmentId)
        .single();

      if (error) throw error;
      setShipment(data);
    } catch (error) {
      console.error('Error loading shipment:', error);
      Alert.alert('Error', 'Failed to load shipment details');
      navigation.goBack();
    } finally {
      setLoading(false);
    }
  };

  const updateShipmentField = useCallback(async (field: string, value: any) => {
    if (!shipment) return;

    try {
      setSaving(true);
      
      // Update local state immediately for responsive UI
      const updatedShipment = { ...shipment, [field]: value };
      setShipment(updatedShipment);
      setHasUnsavedChanges(true);

      // Update in database
      const updateData: ShipmentUpdate = { [field]: value, updated_at: new Date().toISOString() };
      // Using explicit type assertion due to Supabase type generation issues
      const { error } = await (supabase as any)
        .from('shipments')
        .update(updateData)
        .eq('id', shipmentId);

      if (error) throw error;
      
      setHasUnsavedChanges(false);
      
      // Recalculate pricing if address or vehicle details changed
      if (['pickup_address', 'delivery_address', 'vehicle_type', 'pickup_zip', 'delivery_zip'].includes(field)) {
        await recalculatePricing(updatedShipment);
      }
    } catch (error) {
      console.error('Error updating shipment:', error);
      Alert.alert('Error', 'Failed to update shipment');
      // Revert local state
      loadShipmentData();
    } finally {
      setSaving(false);
    }
  }, [shipment, shipmentId]);

  const recalculatePricing = async (shipmentData: ShipmentData) => {
    if (!shipmentData.pickup_zip || !shipmentData.delivery_zip || !shipmentData.vehicle_type) {
      return;
    }

    try {
      const newPrice = await pricingService.getProgressiveEstimate({
        pickupZip: shipmentData.pickup_zip,
        deliveryZip: shipmentData.delivery_zip,
        vehicleType: shipmentData.vehicle_type,
        isAccidentRecovery: shipmentData.is_accident_recovery || false,
      });

      if (newPrice.estimate.total !== shipmentData.estimated_price) {
        await updateShipmentField('estimated_price', newPrice.estimate.total);
      }
    } catch (error) {
      console.error('Error recalculating pricing:', error);
    }
  };

  const handleSaveAll = async () => {
    if (!shipment || !hasUnsavedChanges) return;

    try {
      setSaving(true);
      
      // Using explicit type assertion due to Supabase type generation issues
      const { error } = await (supabase as any)
        .from('shipments')
        .update({ ...shipment, updated_at: new Date().toISOString() })
        .eq('id', shipmentId);

      if (error) throw error;
      
      setHasUnsavedChanges(false);
      Alert.alert('Success', 'All changes saved successfully');
    } catch (error) {
      console.error('Error saving shipment:', error);
      Alert.alert('Error', 'Failed to save changes');
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return Colors.warning;
      case 'in_transit': return Colors.primary;
      case 'delivered': return Colors.success;
      case 'cancelled': return Colors.error;
      default: return Colors.text.secondary;
    }
  };

  if (loading) {
    return (
      <View style={styles.centerContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading shipment details...</Text>
      </View>
    );
  }

  if (!shipment) {
    return (
      <View style={styles.centerContainer}>
        <Text style={styles.errorText}>Shipment not found</Text>
        <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <StatusBar style="dark" />

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => navigation.goBack()}
        >
          <MaterialIcons name="arrow-back" size={24} color={Colors.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerContent}>
          <Text style={styles.title}>Edit Shipment</Text>
          <Text style={styles.trackingNumber}>#{shipment.tracking_number}</Text>
        </View>
        <TouchableOpacity
          style={[styles.saveButton, hasUnsavedChanges && styles.saveButtonActive]}
          onPress={handleSaveAll}
          disabled={!hasUnsavedChanges || saving}
        >
          {saving ? (
            <ActivityIndicator size="small" color="white" />
          ) : (
            <MaterialIcons name="save" size={20} color="white" />
          )}
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {/* Status Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Status</Text>
          <InlineStatusEditor
            value={shipment.status}
            onSave={(value: any) => updateShipmentField('status', value)}
            statusColor={getStatusColor(shipment.status)}
          />
        </View>

        {/* Addresses Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pickup & Delivery</Text>
          
          <InlineAddressEditor
            label="Pickup Address"
            value={shipment.pickup_address}
            city={shipment.pickup_city}
            state={shipment.pickup_state}
            zip={shipment.pickup_zip}
            onSave={async (address: any, components: any) => {
              await updateShipmentField('pickup_address', address);
              if (components.city) await updateShipmentField('pickup_city', components.city);
              if (components.state) await updateShipmentField('pickup_state', components.state);
              if (components.zipCode) await updateShipmentField('pickup_zip', components.zipCode);
            }}
          />

          <InlineAddressEditor
            label="Delivery Address"
            value={shipment.delivery_address}
            city={shipment.delivery_city}
            state={shipment.delivery_state}
            zip={shipment.delivery_zip}
            onSave={async (address: any, components: any) => {
              await updateShipmentField('delivery_address', address);
              if (components.city) await updateShipmentField('delivery_city', components.city);
              if (components.state) await updateShipmentField('delivery_state', components.state);
              if (components.zipCode) await updateShipmentField('delivery_zip', components.zipCode);
            }}
          />
        </View>

        {/* Vehicle Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          
          <InlineVehicleEditor
            vehicleType={shipment.vehicle_type}
            make={shipment.vehicle_make}
            model={shipment.vehicle_model}
            year={shipment.vehicle_year}
            color={shipment.vehicle_color}
            licensePlate={shipment.vehicle_license_plate}
            onSave={async (vehicleData: any) => {
              await updateShipmentField('vehicle_type', vehicleData.type);
              await updateShipmentField('vehicle_make', vehicleData.make);
              await updateShipmentField('vehicle_model', vehicleData.model);
              await updateShipmentField('vehicle_year', vehicleData.year);
              await updateShipmentField('vehicle_color', vehicleData.color);
              await updateShipmentField('vehicle_license_plate', vehicleData.licensePlate);
            }}
          />
        </View>

        {/* Scheduling Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Scheduling</Text>
          
          <InlineDateEditor
            label="Pickup Date"
            value={shipment.pickup_date}
            onSave={(value: any) => updateShipmentField('pickup_date', value)}
          />

          <InlineDateEditor
            label="Delivery Date"
            value={shipment.delivery_date}
            onSave={(value: any) => updateShipmentField('delivery_date', value)}
          />
        </View>

        {/* Notes Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Notes & Instructions</Text>
          
          <InlineTextEditor
            label="Pickup Notes"
            value={shipment.pickup_notes || ''}
            placeholder="Add pickup instructions..."
            multiline
            onSave={(value: any) => updateShipmentField('pickup_notes', value)}
          />

          <InlineTextEditor
            label="Delivery Notes"
            value={shipment.delivery_notes || ''}
            placeholder="Add delivery instructions..."
            multiline
            onSave={(value: any) => updateShipmentField('delivery_notes', value)}
          />

          <InlineTextEditor
            label="Special Instructions"
            value={shipment.special_instructions || ''}
            placeholder="Add special handling instructions..."
            multiline
            onSave={(value: any) => updateShipmentField('special_instructions', value)}
          />
        </View>

        {/* Pricing Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Pricing Information</Text>
          
          <InlinePricingDisplay
            estimatedPrice={shipment.estimated_price}
            distanceMiles={shipment.distance_miles}
            isAccidentRecovery={shipment.is_accident_recovery}
            onRecalculate={() => recalculatePricing(shipment)}
          />
        </View>

        {/* Metadata Section */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Shipment Details</Text>
          
          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Created:</Text>
            <Text style={styles.metadataValue}>
              {format(new Date(shipment.created_at), 'MMM dd, yyyy HH:mm')}
            </Text>
          </View>

          <View style={styles.metadataRow}>
            <Text style={styles.metadataLabel}>Last Updated:</Text>
            <Text style={styles.metadataValue}>
              {format(new Date(shipment.updated_at), 'MMM dd, yyyy HH:mm')}
            </Text>
          </View>

          {shipment.distance_miles && (
            <View style={styles.metadataRow}>
              <Text style={styles.metadataLabel}>Distance:</Text>
              <Text style={styles.metadataValue}>
                {shipment.distance_miles.toFixed(0)} miles
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Floating Save Indicator */}
      {hasUnsavedChanges && (
        <View style={styles.unsavedIndicator}>
          <MaterialIcons name="edit" size={16} color={Colors.warning} />
          <Text style={styles.unsavedText}>Unsaved changes</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  backButton: {
    padding: 8,
  },
  headerContent: {
    flex: 1,
    alignItems: 'center',
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  trackingNumber: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  saveButton: {
    backgroundColor: Colors.text.secondary,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
    minWidth: 44,
    alignItems: 'center',
  },
  saveButtonActive: {
    backgroundColor: Colors.primary,
  },
  content: {
    flex: 1,
    padding: 16,
  },
  section: {
    backgroundColor: 'white',
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    elevation: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 12,
  },
  metadataRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  metadataLabel: {
    fontSize: 14,
    color: Colors.text.secondary,
    fontWeight: '500',
  },
  metadataValue: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  loadingText: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
  },
  errorText: {
    fontSize: 16,
    color: Colors.error,
    textAlign: 'center',
    marginBottom: 20,
  },
  backButtonText: {
    color: Colors.primary,
    fontSize: 16,
    fontWeight: '500',
  },
  unsavedIndicator: {
    position: 'absolute',
    bottom: 20,
    left: 20,
    right: 20,
    backgroundColor: Colors.warning + '20',
    borderColor: Colors.warning,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  unsavedText: {
    marginLeft: 6,
    fontSize: 14,
    color: Colors.warning,
    fontWeight: '500',
  },
});
