import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  TextInput,
  StyleSheet,
  ScrollView,
  Modal,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getVehicleMakes, getModelsForMake, searchVehicleMakes, searchVehicleModels } from '../data/vehicleData';

interface VehicleDropdownProps {
  label: string;
  placeholder: string;
  value?: string;
  onSelect: (value: string) => void;
  type: 'make' | 'model';
  selectedMake?: string; // Required when type is 'model'
  required?: boolean;
  error?: string;
  disabled?: boolean;
  style?: any;
}

const VehicleDropdown: React.FC<VehicleDropdownProps> = ({
  label,
  placeholder,
  value,
  onSelect,
  type,
  selectedMake,
  required = false,
  error,
  disabled = false,
  style,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredOptions, setFilteredOptions] = useState<string[]>([]);
  const searchInputRef = useRef<TextInput>(null);

  // Get options based on type
  const getOptions = (): string[] => {
    if (type === 'make') {
      return searchQuery ? searchVehicleMakes(searchQuery) : getVehicleMakes();
    } else {
      if (!selectedMake) return [];
      return searchQuery 
        ? searchVehicleModels(selectedMake, searchQuery) 
        : getModelsForMake(selectedMake);
    }
  };

  useEffect(() => {
    setFilteredOptions(getOptions());
  }, [searchQuery, type, selectedMake]);

  useEffect(() => {
    // Reset model when make changes
    if (type === 'model' && value && selectedMake) {
      const modelsForMake = getModelsForMake(selectedMake);
      if (!modelsForMake.includes(value)) {
        onSelect('');
      }
    }
  }, [selectedMake, type, value, onSelect]);

  const handleOpen = () => {
    if (disabled) return;
    
    if (type === 'model' && !selectedMake) {
      // Can't select model without make
      return;
    }
    
    setIsOpen(true);
    setSearchQuery('');
    setFilteredOptions(getOptions());
    
    // Focus search input after modal opens
    setTimeout(() => {
      searchInputRef.current?.focus();
    }, 100);
  };

  const handleClose = () => {
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleSelect = (option: string) => {
    onSelect(option);
    handleClose();
  };

  const isModelDisabled = type === 'model' && !selectedMake;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <TouchableOpacity
        style={[
          styles.dropdown,
          error && styles.dropdownError,
          disabled && styles.dropdownDisabled,
          isModelDisabled && styles.dropdownDisabled,
        ]}
        onPress={handleOpen}
        disabled={disabled || isModelDisabled}
      >
        <Text
          style={[
            styles.dropdownText,
            !value && styles.placeholderText,
            (disabled || isModelDisabled) && styles.disabledText,
          ]}
        >
          {value || placeholder}
        </Text>
        <MaterialIcons
          name={isOpen ? "keyboard-arrow-up" : "keyboard-arrow-down"}
          size={24}
          color={disabled || isModelDisabled ? "#ccc" : "#666"}
        />
      </TouchableOpacity>

      {isModelDisabled && (
        <Text style={styles.helper}>
          Please select a vehicle make first
        </Text>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}

      <Modal
        visible={isOpen}
        transparent
        animationType="fade"
        onRequestClose={handleClose}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Select {type === 'make' ? 'Vehicle Make' : `${selectedMake} Model`}
              </Text>
              <TouchableOpacity onPress={handleClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={24} color="#666" />
              </TouchableOpacity>
            </View>

            <View style={styles.searchContainer}>
              <MaterialIcons name="search" size={20} color="#666" style={styles.searchIcon} />
              <TextInput
                ref={searchInputRef}
                style={styles.searchInput}
                placeholder={`Search ${type === 'make' ? 'makes' : 'models'}...`}
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoCapitalize="words"
                autoCorrect={false}
              />
            </View>

            <ScrollView style={styles.optionsList} showsVerticalScrollIndicator={true}>
              {filteredOptions.length > 0 ? (
                filteredOptions.map((option, index) => (
                  <TouchableOpacity
                    key={option}
                    style={[
                      styles.optionItem,
                      value === option && styles.selectedOption,
                      index === filteredOptions.length - 1 && styles.lastOption,
                    ]}
                    onPress={() => handleSelect(option)}
                  >
                    <Text
                      style={[
                        styles.optionText,
                        value === option && styles.selectedOptionText,
                      ]}
                    >
                      {option}
                    </Text>
                    {value === option && (
                      <MaterialIcons name="check" size={20} color="#1E88E5" />
                    )}
                  </TouchableOpacity>
                ))
              ) : (
                <View style={styles.noOptionsContainer}>
                  <MaterialIcons name="search-off" size={48} color="#ccc" />
                  <Text style={styles.noOptionsText}>
                    No {type === 'make' ? 'makes' : 'models'} found
                  </Text>
                  <Text style={styles.noOptionsSubtext}>
                    Try adjusting your search
                  </Text>
                </View>
              )}
            </ScrollView>

            {type === 'make' && (
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  {filteredOptions.length} {filteredOptions.length === 1 ? 'make' : 'makes'} available
                </Text>
              </View>
            )}
            
            {type === 'model' && selectedMake && (
              <View style={styles.modalFooter}>
                <Text style={styles.footerText}>
                  {filteredOptions.length} {filteredOptions.length === 1 ? 'model' : 'models'} for {selectedMake}
                </Text>
              </View>
            )}
          </View>
        </View>
      </Modal>
    </View>
  );
};

const { height: screenHeight } = Dimensions.get('window');

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1E88E5',
    marginBottom: 8,
  },
  required: {
    color: '#E53E3E',
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    backgroundColor: '#fff',
  },
  dropdownError: {
    borderColor: '#E53E3E',
  },
  dropdownDisabled: {
    backgroundColor: '#F5F5F5',
    borderColor: '#D0D0D0',
  },
  dropdownText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  placeholderText: {
    color: '#999',
  },
  disabledText: {
    color: '#999',
  },
  helper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#E53E3E',
    marginTop: 4,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: '#fff',
    borderRadius: 12,
    margin: 20,
    maxHeight: screenHeight * 0.8,
    width: '90%',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 20,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333',
    flex: 1,
  },
  closeButton: {
    padding: 4,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 16,
    paddingHorizontal: 16,
    height: 44,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 16,
    color: '#333',
  },
  optionsList: {
    maxHeight: screenHeight * 0.5,
  },
  optionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  selectedOption: {
    backgroundColor: '#F0F7FF',
  },
  lastOption: {
    borderBottomWidth: 0,
  },
  optionText: {
    fontSize: 16,
    color: '#333',
    flex: 1,
  },
  selectedOptionText: {
    color: '#1E88E5',
    fontWeight: '600',
  },
  noOptionsContainer: {
    alignItems: 'center',
    padding: 40,
  },
  noOptionsText: {
    fontSize: 16,
    color: '#666',
    marginTop: 12,
    fontWeight: '500',
  },
  noOptionsSubtext: {
    fontSize: 14,
    color: '#999',
    marginTop: 4,
  },
  modalFooter: {
    padding: 16,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    backgroundColor: '#F9F9F9',
  },
  footerText: {
    fontSize: 12,
    color: '#666',
    textAlign: 'center',
  },
});

export default VehicleDropdown;