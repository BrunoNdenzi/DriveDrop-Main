import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface InlineStatusEditorProps {
  value: string;
  onSave: (value: string) => Promise<void> | void;
  statusColor: string;
  editable?: boolean;
}

const statusOptions = [
  { value: 'draft', label: 'Draft', icon: 'edit', color: Colors.text.secondary },
  { value: 'pending', label: 'Pending', icon: 'schedule', color: Colors.warning },
  { value: 'accepted', label: 'Accepted', icon: 'check-circle', color: Colors.info },
  { value: 'in_transit', label: 'In Transit', icon: 'local-shipping', color: Colors.primary },
  { value: 'delivered', label: 'Delivered', icon: 'done-all', color: Colors.success },
  { value: 'cancelled', label: 'Cancelled', icon: 'cancel', color: Colors.error },
];

export default function InlineStatusEditor({
  value,
  onSave,
  statusColor,
  editable = true,
}: InlineStatusEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleStatusSelect = async (newStatus: string) => {
    if (newStatus === value) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      await onSave(newStatus);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving status:', error);
      // Keep editing mode open on error
    } finally {
      setSaving(false);
    }
  };

  const currentStatus = statusOptions.find(option => option.value === value);
  const displayLabel = currentStatus?.label || value;
  const displayIcon = currentStatus?.icon || 'help';

  return (
    <>
      <TouchableOpacity
        style={[styles.container, !editable && styles.disabledContainer]}
        onPress={handleStartEdit}
        disabled={!editable}
        activeOpacity={0.7}
      >
        <View style={styles.displayContainer}>
          <Text style={styles.label}>Status</Text>
          <View style={styles.statusContainer}>
            <View style={[styles.statusBadge, { backgroundColor: statusColor }]}>
              <MaterialIcons 
                name={displayIcon as any} 
                size={16} 
                color="white" 
                style={styles.statusIcon}
              />
              <Text style={styles.statusText}>{displayLabel}</Text>
            </View>
            {editable && (
              <MaterialIcons
                name="edit"
                size={16}
                color={Colors.text.secondary}
                style={styles.editIcon}
              />
            )}
          </View>
        </View>
      </TouchableOpacity>

      {/* Status Selection Modal */}
      <Modal
        visible={isEditing}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={handleCancel}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleCancel}
              disabled={saving}
            >
              <Text style={styles.cancelButtonText}>Cancel</Text>
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Change Status</Text>
            <View style={styles.modalButton} />
          </View>

          <ScrollView style={styles.modalContent}>
            {statusOptions.map((option) => (
              <TouchableOpacity
                key={option.value}
                style={[
                  styles.statusOption,
                  option.value === value && styles.selectedStatusOption,
                ]}
                onPress={() => handleStatusSelect(option.value)}
                disabled={saving}
              >
                <View style={styles.statusOptionContent}>
                  <View style={[styles.statusOptionBadge, { backgroundColor: option.color }]}>
                    <MaterialIcons 
                      name={option.icon as any} 
                      size={20} 
                      color="white" 
                    />
                  </View>
                  <View style={styles.statusOptionText}>
                    <Text style={styles.statusOptionLabel}>{option.label}</Text>
                    <Text style={styles.statusOptionDescription}>
                      {getStatusDescription(option.value)}
                    </Text>
                  </View>
                  {option.value === value && (
                    <MaterialIcons 
                      name="check" 
                      size={20} 
                      color={Colors.primary} 
                    />
                  )}
                </View>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}

function getStatusDescription(status: string): string {
  switch (status) {
    case 'draft': return 'Shipment is being prepared';
    case 'pending': return 'Waiting for driver assignment';
    case 'accepted': return 'Driver assigned and confirmed';
    case 'in_transit': return 'Vehicle is being transported';
    case 'delivered': return 'Shipment completed successfully';
    case 'cancelled': return 'Shipment was cancelled';
    default: return '';
  }
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  displayContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background + '80',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 8,
  },
  statusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  statusIcon: {
    marginRight: 6,
  },
  statusText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  editIcon: {
    marginLeft: 8,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'white',
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    paddingTop: Platform.OS === 'ios' ? 50 : 20,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: 'white',
  },
  modalButton: {
    minWidth: 60,
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
  },
  cancelButtonText: {
    fontSize: 16,
    color: Colors.primary,
  },
  modalContent: {
    flex: 1,
    padding: 16,
  },
  statusOption: {
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    marginBottom: 8,
    backgroundColor: Colors.background + '50',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  selectedStatusOption: {
    backgroundColor: Colors.primary + '10',
    borderColor: Colors.primary + '30',
  },
  statusOptionContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusOptionBadge: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  statusOptionText: {
    flex: 1,
  },
  statusOptionLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 2,
  },
  statusOptionDescription: {
    fontSize: 14,
    color: Colors.text.secondary,
  },
});
