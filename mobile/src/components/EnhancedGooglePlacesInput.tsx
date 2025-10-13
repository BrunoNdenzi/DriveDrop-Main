/**
 * Enhanced Google Places Input Component
 * Supports both full address autocomplete and ZIP code lookup
 * Provides comprehensive address validation and formatting
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, ThemeColors } from '../constants/Colors';
import { getGoogleMapsApiKey } from '../utils/googleMaps';
import {
  searchAddress,
  extractAddressComponents,
  lookupZipCode,
  validateZipCode,
  formatZipCode,
  standardizeAddress,
  looksLikeZipCode,
  AddressComponents,
  ZipCodeInfo,
} from '../utils/addressUtils';

interface AddressDetails {
  formattedAddress: string;
  components: AddressComponents;
  coordinates?: { lat: number; lng: number };
  zipInfo?: ZipCodeInfo;
  isZipCodeLookup: boolean;
}

interface EnhancedGooglePlacesInputProps {
  label: string;
  placeholder?: string;
  value?: string;
  onAddressSelect: (address: string, details: AddressDetails) => void;
  onAddressChange?: (text: string) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  disabled?: boolean;
  enableZipLookup?: boolean; // Enable ZIP code to city/state lookup
  validateInput?: boolean; // Enable real-time validation
  autoFocus?: boolean; // Auto focus the input field
  style?: any;
}

interface Prediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

const EnhancedGooglePlacesInput: React.FC<EnhancedGooglePlacesInputProps> = ({
  label,
  placeholder = "Street, City, State ZIP",
  value = '',
  onAddressSelect,
  onAddressChange,
  required = false,
  helper,
  error,
  disabled = false,
  enableZipLookup = true,
  validateInput = true,
  autoFocus = false,
  style,
}) => {
  const [inputText, setInputText] = useState(value);
  const [predictions, setPredictions] = useState<Prediction[]>([]);
  const [showPredictions, setShowPredictions] = useState(false);
  const [loading, setLoading] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);
  const [zipInfo, setZipInfo] = useState<ZipCodeInfo | null>(null);
  const [isZipQuery, setIsZipQuery] = useState(false);

  const inputRef = useRef<TextInput>(null);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const apiKey = getGoogleMapsApiKey();

  // Update input when value prop changes
  useEffect(() => {
    setInputText(value);
  }, [value]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, []);

  const searchPlaces = async (query: string) => {
    if (!query.trim() || !apiKey) {
      setPredictions([]);
      setZipInfo(null);
      setIsZipQuery(false);
      return;
    }

    try {
      setLoading(true);
      setValidationError(null);

      const result = await searchAddress(query, apiKey, enableZipLookup);
      
      setPredictions(result.predictions);
      setZipInfo(result.zipInfo || null);
      setIsZipQuery(result.isZipCodeQuery);
      
      // Show predictions if we have them, or if we have ZIP info
      setShowPredictions(result.predictions.length > 0 || !!result.zipInfo);

    } catch (error) {
      console.error('Places search error:', error);
      setValidationError('Failed to search addresses. Please try again.');
      setPredictions([]);
      setZipInfo(null);
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (text: string) => {
    setInputText(text);
    onAddressChange?.(text);

    // Clear previous validation errors
    setValidationError(null);

    // Debounced search
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    debounceRef.current = setTimeout(() => {
      searchPlaces(text);
    }, 300);
  };

  const handlePredictionSelect = async (prediction: Prediction) => {
    try {
      // Immediately hide predictions and clear state to prevent double-click
      setShowPredictions(false);
      setPredictions([]);
      setLoading(true);
      
      // Dismiss keyboard
      inputRef.current?.blur();
      
      // Get place details
      const detailsResponse = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${prediction.place_id}&fields=formatted_address,address_components,geometry&key=${apiKey}`
      );

      if (!detailsResponse.ok) {
        throw new Error('Failed to get place details');
      }

      const detailsData = await detailsResponse.json();

      if (detailsData.status !== 'OK' || !detailsData.result) {
        throw new Error('Invalid place details response');
      }

      const placeDetails = detailsData.result;
      const components = extractAddressComponents(placeDetails);
      const formattedAddress = standardizeAddress(placeDetails.formatted_address, components);

      // Extract coordinates if available
      const coordinates = placeDetails.geometry?.location ? {
        lat: placeDetails.geometry.location.lat,
        lng: placeDetails.geometry.location.lng
      } : undefined;

      setInputText(formattedAddress);

      // Provide detailed address information
      const addressDetails: AddressDetails = {
        formattedAddress,
        components,
        coordinates,
        isZipCodeLookup: false,
      };

      onAddressSelect(formattedAddress, addressDetails);

    } catch (error) {
      console.error('Error getting place details:', error);
      Alert.alert('Error', 'Failed to get address details. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleZipInfoSelect = () => {
    if (!zipInfo) return;

    const formattedAddress = `${zipInfo.city}, ${zipInfo.stateCode} ${zipInfo.zipCode}`;
    setInputText(formattedAddress);
    setShowPredictions(false);
    setZipInfo(null);

    // Create address details from ZIP info
    const addressDetails: AddressDetails = {
      formattedAddress,
      components: {
        city: zipInfo.city,
        state: zipInfo.state,
        stateCode: zipInfo.stateCode,
        zipCode: zipInfo.zipCode,
        county: zipInfo.county,
        coordinates: zipInfo.coordinates,
        formattedAddress,
      },
      zipInfo,
      isZipCodeLookup: true,
    };

    onAddressSelect(formattedAddress, addressDetails);
  };

  const validateCurrentInput = () => {
    if (!validateInput || !inputText.trim()) return;

    if (looksLikeZipCode(inputText)) {
      if (!validateZipCode(inputText)) {
        setValidationError('Please enter a valid 5-digit ZIP code');
      }
    } else if (inputText.length < 5) {
      setValidationError('Please enter a complete address');
    }
  };

  const handleBlur = () => {
    validateCurrentInput();
    // Delay hiding predictions to allow selection
    setTimeout(() => {
      setShowPredictions(false);
    }, 150);
  };

  const handleFocus = () => {
    if (predictions.length > 0 || zipInfo) {
      setShowPredictions(true);
    }
  };

  const renderPrediction = ({ item }: { item: Prediction }) => (
    <TouchableOpacity
      style={styles.predictionItem}
      onPress={() => handlePredictionSelect(item)}
    >
      <MaterialIcons name="location-on" size={20} color={ThemeColors.primary} />
      <View style={styles.predictionText}>
        <Text style={styles.predictionMain}>{item.structured_formatting.main_text}</Text>
        <Text style={styles.predictionSecondary}>{item.structured_formatting.secondary_text}</Text>
      </View>
    </TouchableOpacity>
  );

  const renderZipInfo = () => (
    <TouchableOpacity
      style={styles.zipInfoItem}
      onPress={handleZipInfoSelect}
    >
      <MaterialIcons name="location-city" size={20} color={ThemeColors.secondary} />
      <View style={styles.predictionText}>
        <Text style={styles.predictionMain}>{zipInfo!.city}, {zipInfo!.stateCode}</Text>
        <Text style={styles.predictionSecondary}>ZIP Code: {zipInfo!.zipCode}</Text>
      </View>
      <MaterialIcons name="arrow-forward" size={16} color={ThemeColors.textSecondary} />
    </TouchableOpacity>
  );

  const displayError = error || validationError;

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          ref={inputRef}
          style={[
            styles.textInput,
            disabled && styles.textInputDisabled,
            displayError && styles.textInputError,
          ]}
          placeholder={placeholder}
          value={inputText}
          onChangeText={handleInputChange}
          onFocus={handleFocus}
          onBlur={handleBlur}
          editable={!disabled}
          autoCapitalize="words"
          autoCorrect={false}
          autoFocus={autoFocus}
          placeholderTextColor={ThemeColors.textSecondary}
        />
        
        {loading && (
          <ActivityIndicator 
            size="small" 
            color={ThemeColors.primary} 
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {/* Predictions List */}
      {showPredictions && (predictions.length > 0 || zipInfo) && (
        <View style={styles.predictionsContainer}>
          {/* ZIP Code Info */}
          {zipInfo && renderZipInfo()}
          
          {/* Address Predictions */}
          <ScrollView
            style={styles.predictionsList}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
            nestedScrollEnabled={true}
          >
            {predictions.map((item) => (
              <View key={item.place_id}>
                {renderPrediction({ item })}
              </View>
            ))}
          </ScrollView>
        </View>
      )}

      {/* Helper Text */}
      {helper && !displayError && (
        <Text style={styles.helper}>{helper}</Text>
      )}

      {/* Error Text */}
      {displayError && (
        <Text style={styles.error}>{displayError}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginVertical: 8,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: ThemeColors.text,
    marginBottom: 8,
  },
  required: {
    color: ThemeColors.danger,
  },
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    borderWidth: 1,
    borderColor: ThemeColors.border,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: ThemeColors.background,
    color: ThemeColors.text,
  },
  textInputDisabled: {
    backgroundColor: ThemeColors.background,
    opacity: 0.6,
    color: ThemeColors.textSecondary,
  },
  textInputError: {
    borderColor: ThemeColors.danger,
  },
  loadingIndicator: {
    position: 'absolute',
    right: 12,
    top: 12,
  },
  predictionsContainer: {
    backgroundColor: ThemeColors.background,
    borderWidth: 1,
    borderColor: ThemeColors.border,
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    maxHeight: 200,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
  },
  predictionsList: {
    maxHeight: 160,
  },
  predictionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: ThemeColors.border,
  },
  zipInfoItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    backgroundColor: ThemeColors.primary + '10',
    borderBottomWidth: 1,
    borderBottomColor: ThemeColors.border,
  },
  predictionText: {
    flex: 1,
    marginLeft: 12,
  },
  predictionMain: {
    fontSize: 16,
    fontWeight: '500',
    color: ThemeColors.text,
  },
  predictionSecondary: {
    fontSize: 14,
    color: ThemeColors.textSecondary,
    marginTop: 2,
  },
  helper: {
    fontSize: 14,
    color: ThemeColors.textSecondary,
    marginTop: 4,
  },
  error: {
    fontSize: 14,
    color: ThemeColors.danger,
    marginTop: 4,
  },
});

export default EnhancedGooglePlacesInput;
