import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Modal,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';
import EnhancedGooglePlacesInput from './EnhancedGooglePlacesInput';
import { AddressComponents } from '../utils/addressUtils';

interface InlineAddressEditorProps {
  label: string;
  value: string;
  city?: string;
  state?: string;
  zip?: string;
  onSave: (
    address: string, 
    components: AddressComponents
  ) => Promise<void> | void;
  editable?: boolean;
}

export default function InlineAddressEditor({
  label,
  value,
  city,
  state,
  zip,
  onSave,
  editable = true,
}: InlineAddressEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const handleAddressSelect = async (address: string, details: any) => {
    try {
      setSaving(true);
      await onSave(address, details.components);
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving address:', error);
      // Keep editing mode open on error
    } finally {
      setSaving(false);
    }
  };

  const formatDisplayAddress = () => {
    if (!value) return 'Add address...';
    
    // If we have city, state, zip, show formatted version
    if (city && state) {
      return `${value}\n${city}, ${state}${zip ? ` ${zip}` : ''}`;
    }
    
    return value;
  };

  return (
    <>
      <TouchableOpacity
        style={[styles.container, !editable && styles.disabledContainer]}
        onPress={handleStartEdit}
        disabled={!editable}
        activeOpacity={0.7}
      >
        <View style={styles.displayContainer}>
          <Text style={styles.label}>{label}</Text>
          <View style={styles.valueContainer}>
            <View style={styles.addressContainer}>
              <Text
                style={[
                  styles.displayValue,
                  !value && styles.placeholderValue,
                ]}
              >
                {formatDisplayAddress()}
              </Text>
              {zip && (
                <View style={styles.zipBadge}>
                  <Text style={styles.zipText}>{zip}</Text>
                </View>
              )}
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

      {/* Address Editing Modal */}
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
            <Text style={styles.modalTitle}>Edit {label}</Text>
            <View style={styles.modalButton} />
          </View>

          <View style={styles.modalContent}>
            <EnhancedGooglePlacesInput
              label={label}
              placeholder={`Enter ${label.toLowerCase()}...`}
              value={value}
              onAddressSelect={handleAddressSelect}
              required
              helper="Search for an address or enter manually"
              enableZipLookup={true}
              validateInput={true}
              autoFocus={true}
            />
          </View>
        </View>
      </Modal>
    </>
  );
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
    marginBottom: 6,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  addressContainer: {
    flex: 1,
    flexDirection: 'column',
  },
  displayValue: {
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  placeholderValue: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  zipBadge: {
    backgroundColor: Colors.primary + '20',
    borderColor: Colors.primary,
    borderWidth: 1,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 6,
    alignSelf: 'flex-start',
  },
  zipText: {
    fontSize: 12,
    color: Colors.primary,
    fontWeight: '500',
  },
  editIcon: {
    marginLeft: 8,
    marginTop: 2,
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
});
