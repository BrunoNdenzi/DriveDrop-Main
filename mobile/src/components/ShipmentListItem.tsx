import React from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ViewStyle } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Shipment, shipmentStatusMap, formatDate } from '../types';
import { Colors } from '../constants/Colors';

interface ShipmentListItemProps {
  shipment: Shipment;
  onPress: (shipment: Shipment) => void;
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
            {shipment.title}
          </Text>
          <View
            style={[
              styles.statusBadge,
              { backgroundColor: Colors.status[shipment.status] || Colors.text.secondary },
            ]}
          >
            <Text style={styles.statusText}>
              {shipmentStatusMap[shipment.status]}
            </Text>
          </View>
        </View>

        <View style={styles.addressContainer}>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.primary} style={styles.icon} />
            <Text style={styles.addressText} numberOfLines={1}>
              {shipment.pickupAddress}
            </Text>
          </View>
          <View style={styles.addressRow}>
            <Ionicons name="location" size={16} color={Colors.secondary} style={styles.icon} />
            <Text style={styles.addressText} numberOfLines={1}>
              {shipment.deliveryAddress}
            </Text>
          </View>
        </View>

        <View style={styles.footer}>
          <Text style={styles.dateText}>
            {formatDate(shipment.pickupDate)}
          </Text>
          {shipment.price && (
            <Text style={styles.priceText}>
              ${shipment.price.toFixed(2)}
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
