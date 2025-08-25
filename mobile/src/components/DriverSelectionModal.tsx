import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  FlatList,
  Modal,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface Driver {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  avatar_url?: string;
  rating?: number;
}

interface DriverSelectionModalProps {
  isVisible: boolean;
  drivers: Driver[];
  selectedShipmentId: string | null;
  onClose: () => void;
  onSelectDriver: (driverId: string, driverName: string) => void;
}

/**
 * DriverSelectionModal component for the Admin Assignment screen
 * Extracted as part of T003 refactoring to reduce component complexity
 */
const DriverSelectionModal: React.FC<DriverSelectionModalProps> = ({
  isVisible,
  drivers,
  selectedShipmentId,
  onClose,
  onSelectDriver,
}) => {
  const renderDriverItem = ({ item }: { item: Driver }) => (
    <TouchableOpacity
      style={styles.driverModalItem}
      onPress={() => {
        onClose();
        if (selectedShipmentId) {
          onSelectDriver(
            item.id,
            `${item.first_name} ${item.last_name}`
          );
        }
      }}
    >
      <View style={styles.driverAvatar}>
        <Text style={styles.avatarText}>
          {item.first_name.charAt(0)}
          {item.last_name.charAt(0)}
        </Text>
      </View>
      <View style={styles.driverInfo}>
        <Text style={styles.driverName}>
          {item.first_name} {item.last_name}
        </Text>
        {item.rating && (
          <View style={styles.ratingContainer}>
            <MaterialIcons name="star" size={16} color="#FFD700" />
            <Text style={styles.ratingText}>{item.rating.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <MaterialIcons
        name="arrow-forward-ios"
        size={16}
        color={Colors.text.secondary}
      />
    </TouchableOpacity>
  );

  return (
    <Modal
      visible={isVisible}
      animationType="slide"
      transparent={true}
      onRequestClose={onClose}
    >
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Select a Driver</Text>
            <TouchableOpacity
              onPress={onClose}
              style={styles.closeButton}
            >
              <MaterialIcons
                name="close"
                size={24}
                color={Colors.text.primary}
              />
            </TouchableOpacity>
          </View>

          <FlatList
            data={drivers}
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
  );
};

const styles = StyleSheet.create({
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
  avatarText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  driverInfo: {
    flex: 1,
  },
  driverName: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
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
  noDriversContainer: {
    padding: 20,
    alignItems: 'center',
  },
  noDriversText: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
});

export default DriverSelectionModal;
