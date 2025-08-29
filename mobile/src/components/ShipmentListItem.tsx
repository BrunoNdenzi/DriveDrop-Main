import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { shipmentStatusMap, formatDate } from '../types/shipment';
import { Colors } from '../constants/Colors';

interface ApiShipment {
  id: string;
  title?: string;
  pickup_address?: string;
  delivery_address?: string;
  status?: string;
  created_at?: string;
  estimated_price?: number;
}

interface ShipmentListItemProps {
  shipment: ApiShipment;
  onPress: (shipment: ApiShipment) => void;
  style?: ViewStyle;
}

export function ShipmentListItem({ shipment, onPress, style }: ShipmentListItemProps) {
  return (
    <TouchableOpacity
      style={[styles.container, style]}
      onPress={() => onPress(shipment)}
      activeOpacity={0.7}
    >
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.title} numberOfLines={1}>
            {shipment.title || 'Shipment'}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: shipment.status ? (Colors.status as any)[shipment.status] || Colors.text.secondary : Colors.text.secondary },
            ]}
          >
            <Text style={styles.statusText}>
              {shipment.status ? shipmentStatusMap[shipment.status as keyof typeof shipmentStatusMap] : 'Unknown'}
            </Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.primary} style={styles.icon} />
            <Text style={styles.addressText} numberOfLines={1}>
              {shipment.pickup_address || 'Pickup TBD'}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.secondary} style={styles.icon} />
            <Text style={styles.addressText} numberOfLines={1}>
              {shipment.delivery_address || 'Delivery TBD'}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.dateText}>
            {shipment.created_at ? formatDate(shipment.created_at) : ''}
          </Text>
          {(shipment.estimated_price) && (
            <Text style={styles.priceText}>
              ${Number(shipment.estimated_price).toFixed(2)}
            </Text>
          )}
        </View>
      </View>
      <Ionicons
        name="chevron-forward"
        size={20}
        color={Colors.text.secondary}
        style={styles.chevron}
      />
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    marginVertical: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  contentContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  title: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    flex: 1,
    marginRight: 8,
  },
  statusBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    color: Colors.text.inverse,
  },
  addressContainer: {
    marginVertical: 8,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 4,
  },
  icon: {
    marginRight: 8,
  },
  addressText: {
    fontSize: 14,
    color: Colors.text.secondary,
    flex: 1,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 8,
  },
  dateText: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
  priceText: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  chevron: {
    marginLeft: 8,
  },
});
