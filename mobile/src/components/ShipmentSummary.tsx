import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity } from 'react-native';
import { Colors } from '../constants/Colors';

type ShipmentStatus = 'pending' | 'in_transit' | 'delivered' | 'cancelled';

interface Shipment {
  id: string;
  tracking_number: string;
  status: ShipmentStatus;
  origin_address: string;
  destination_address: string;
  created_at: string;
  estimated_delivery?: string;
  price?: number;
}

interface ShipmentSummaryProps {
  shipment: Shipment;
  onPress: () => void;
}

export function ShipmentSummary({ shipment, onPress }: ShipmentSummaryProps) {
  const getStatusColor = (status: ShipmentStatus) => {
    switch (status) {
      case 'pending':
        return Colors.warning;
      case 'in_transit':
        return Colors.primary;
      case 'delivered':
        return Colors.success;
      case 'cancelled':
        return Colors.error;
      default:
        return Colors.text.secondary;
    }
  };

  const getStatusLabel = (status: ShipmentStatus) => {
    switch (status) {
      case 'pending':
        return 'Pending';
      case 'in_transit':
        return 'In Transit';
      case 'delivered':
        return 'Delivered';
      case 'cancelled':
        return 'Cancelled';
      default:
        return 'Unknown';
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  const truncateAddress = (address: string, maxLength = 35) => {
    return address.length > maxLength
      ? `${address.substring(0, maxLength)}...`
      : address;
  };

  return (
    <TouchableOpacity style={styles.container} onPress={onPress} activeOpacity={0.7}>
      <View style={styles.header}>
        <Text style={styles.trackingNumber}>#{shipment.tracking_number}</Text>
        <View style={[styles.statusBadge, { backgroundColor: getStatusColor(shipment.status) }]}>
          <Text style={styles.statusText}>{getStatusLabel(shipment.status)}</Text>
        </View>
      </View>

      <View style={styles.details}>
        <View style={styles.addressContainer}>
          <Text style={styles.label}>From</Text>
          <Text style={styles.address}>{truncateAddress(shipment.origin_address)}</Text>
        </View>
        <View style={styles.addressContainer}>
          <Text style={styles.label}>To</Text>
          <Text style={styles.address}>{truncateAddress(shipment.destination_address)}</Text>
        </View>
      </View>

      <View style={styles.footer}>
        <Text style={styles.date}>Created: {formatDate(shipment.created_at)}</Text>
        {shipment.price && (
          <Text style={styles.price}>${shipment.price.toFixed(2)}</Text>
        )}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  trackingNumber: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  statusText: {
    color: 'white',
    fontSize: 12,
    fontWeight: '600',
  },
  details: {
    marginBottom: 12,
  },
  addressContainer: {
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: Colors.text.secondary,
    marginBottom: 2,
  },
  address: {
    fontSize: 14,
    color: Colors.text.primary,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 12,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  date: {
    fontSize: 12,
    color: Colors.text.secondary,
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.primary,
  },
});
