import React, { useState, useRef } from 'react';
import {
  StyleSheet,
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Platform,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors } from '../constants/Colors';

interface InlineTextEditorProps {
  label: string;
  value: string;
  placeholder?: string;
  multiline?: boolean;
  onSave: (value: string) => Promise<void> | void;
  editable?: boolean;
  maxLength?: number;
}

export default function InlineTextEditor({
  label,
  value,
  placeholder = 'Enter text...',
  multiline = false,
  onSave,
  editable = true,
  maxLength,
}: InlineTextEditorProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const handleStartEdit = () => {
    if (!editable) return;
    setEditValue(value);
    setIsEditing(true);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const handleCancel = () => {
    setEditValue(value);
    setIsEditing(false);
  };

  const handleSave = async () => {
    if (editValue.trim() === value.trim()) {
      setIsEditing(false);
      return;
    }

    try {
      setSaving(true);
      await onSave(editValue.trim());
      setIsEditing(false);
    } catch (error) {
      console.error('Error saving value:', error);
      // Keep editing mode open on error
    } finally {
      setSaving(false);
    }
  };

  const displayValue = value || placeholder;
  const isEmpty = !value;

  if (isEditing) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.editContainer}>
          <TextInput
            ref={inputRef}
            style={[
              styles.textInput,
              multiline && styles.textInputMultiline,
            ]}
            value={editValue}
            onChangeText={setEditValue}
            placeholder={placeholder}
            placeholderTextColor={Colors.text.secondary}
            multiline={multiline}
            numberOfLines={multiline ? 3 : 1}
            maxLength={maxLength}
            autoFocus
            selectionColor={Colors.primary}
          />
          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={handleCancel}
              disabled={saving}
            >
              <MaterialIcons name="close" size={16} color={Colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.saveButton]}
              onPress={handleSave}
              disabled={saving}
            >
              <MaterialIcons name="check" size={16} color="white" />
            </TouchableOpacity>
          </View>
        </View>
        {maxLength && (
          <Text style={styles.characterCount}>
            {editValue.length}/{maxLength}
          </Text>
        )}
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={[styles.container, !editable && styles.disabledContainer]}
      onPress={handleStartEdit}
      disabled={!editable}
      activeOpacity={0.7}
    >
      <View style={styles.displayContainer}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueContainer}>
          <Text
            style={[
              styles.displayValue,
              isEmpty && styles.placeholderValue,
              multiline && styles.multilineValue,
            ]}
            numberOfLines={multiline ? undefined : 1}
          >
            {displayValue}
          </Text>
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
  editContainer: {
    flexDirection: 'column',
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
  displayValue: {
    flex: 1,
    fontSize: 16,
    color: Colors.text.primary,
    lineHeight: 22,
  },
  placeholderValue: {
    color: Colors.text.secondary,
    fontStyle: 'italic',
  },
  multilineValue: {
    minHeight: 44,
  },
  editIcon: {
    marginLeft: 8,
    marginTop: 2,
  },
  textInput: {
    borderWidth: 2,
    borderColor: Colors.primary,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: 'white',
    color: Colors.text.primary,
    minHeight: 44,
  },
  textInputMultiline: {
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: 8,
    gap: 8,
  },
  button: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 6,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 36,
  },
  cancelButton: {
    backgroundColor: Colors.background,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  saveButton: {
    backgroundColor: Colors.primary,
  },
  characterCount: {
    fontSize: 12,
    color: Colors.text.secondary,
    textAlign: 'right',
    marginTop: 4,
  },
});
