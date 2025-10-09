import React, { useState } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { format } from 'date-fns';
import { Colors } from '../constants/Colors';

interface InlineDateEditorProps {
  label: string;
  value?: string;
  onSave: (value: string) => Promise<void> | void;
  editable?: boolean;
  minimumDate?: Date;
  maximumDate?: Date;
}

export default function InlineDateEditor({
  label,
  value,
  onSave,
  editable = true,
  minimumDate,
  maximumDate,
}: InlineDateEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [saving, setSaving] = useState(false);

  const currentDate = value ? new Date(value) : new Date();

  const handleStartEdit = () => {
    if (!editable) return;
    setIsEditing(true);
  };

  const handleDateChange = async (event: any, selectedDate?: Date) => {
    setIsEditing(Platform.OS === 'ios'); // Keep open on iOS, close on Android
    
    if (selectedDate) {
      try {
        setSaving(true);
        await onSave(selectedDate.toISOString());
      } catch (error) {
        console.error('Error saving date:', error);
      } finally {
        setSaving(false);
      }
    }
  };

  const handleCancel = () => {
    setIsEditing(false);
  };

  const formatDisplayDate = () => {
    if (!value) return 'Select date...';
    
    try {
      return format(new Date(value), 'MMM dd, yyyy');
    } catch (error) {
      return 'Invalid date';
    }
  };

  const formatDisplayTime = () => {
    if (!value) return '';
    
    try {
      return format(new Date(value), 'h:mm a');
    } catch (error) {
      return '';
    }
  };

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.displayContainer, !editable && styles.disabledContainer]}
        onPress={handleStartEdit}
        disabled={!editable}
        activeOpacity={0.7}
      >
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <View style={styles.dateContainer}>
            <Text
              style={[
                styles.displayValue,
                !value && styles.placeholderValue,
              ]}
            >
              {formatDisplayDate()}
            </Text>
            {value && formatDisplayTime() && (
              <Text style={styles.timeValue}>
                {formatDisplayTime()}
              </Text>
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
      </TouchableOpacity>

      {/* Date Picker */}
      {isEditing && (
        <>
          {Platform.OS === 'ios' && (
            <View style={styles.iosPickerContainer}>
              <View style={styles.iosPickerHeader}>
                <TouchableOpacity onPress={handleCancel}>
                  <Text style={styles.cancelButton}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setIsEditing(false)}>
                  <Text style={styles.doneButton}>Done</Text>
                </TouchableOpacity>
              </View>
              <DateTimePicker
                value={currentDate}
                mode="datetime"
                display="spinner"
                onChange={handleDateChange}
                minimumDate={minimumDate}
                maximumDate={maximumDate}
                style={styles.iosDatePicker}
              />
            </View>
          )}
          
          {Platform.OS === 'android' && (
            <DateTimePicker
              value={currentDate}
              mode="datetime"
              display="default"
              onChange={handleDateChange}
              minimumDate={minimumDate}
              maximumDate={maximumDate}
            />
          )}
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  displayContainer: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: Colors.background + '80',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  disabledContainer: {
    opacity: 0.6,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: Colors.text.secondary,
    marginBottom: 6,
  },
  valueContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dateContainer: {
    flex: 1,
  },
  displayValue: {
    fontSize: 16,
    color: Colors.text.primary,
    fontWeight: '500',
  },
  placeholderValue: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
    fontWeight: 'normal',
  },
  timeValue: {
    fontSize: 14,
    color: Colors.text.secondary,
    marginTop: 2,
  },
  editIcon: {
    marginLeft: 8,
  },
  iosPickerContainer: {
    backgroundColor: 'white',
    borderRadius: 12,
    marginTop: 8,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  iosPickerHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  cancelButton: {
    fontSize: 16,
    color: Colors.text.secondary,
  },
  doneButton: {
    fontSize: 16,
    color: Colors.primary,
    fontWeight: '600',
  },
  iosDatePicker: {
    height: 200,
  },
});
