/**
 * PreciseLocationInput - Enhanced Google Places Autocomplete for Driver Precision
 * 
 * This component provides street-level precision for pickup/delivery locations
 * specifically designed for driver navigation needs.
 * 
 * Features:
 * - Street-level autocomplete
 * - Precise coordinates
 * - Address validation
 * - Driver-friendly formatting
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
import { getGoogleMapsApiKey } from '../utils/googleMaps';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
  types: string[];
}

interface PlaceDetails {
  formatted_address: string;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  address_components: Array<{
    long_name: string;
    short_name: string;
    types: string[];
  }>;
  place_id: string;
}

interface PreciseLocationInputProps {
  label: string;
  placeholder: string;
  value?: string;
  onLocationSelect: (address: string, coordinates?: { lat: number; lng: number }, details?: PlaceDetails) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  style?: any;
  disabled?: boolean;
}

const PreciseLocationInput: React.FC<PreciseLocationInputProps> = ({
  label,
  placeholder,
  value,
  onLocationSelect,
  required = false,
  helper,
  error,
  style,
  disabled = false,
}) => {
  const [inputValue, setInputValue] = useState(value || '');
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [loading, setLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [apiKey, setApiKey] = useState('');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const key = getGoogleMapsApiKey();
    setApiKey(key);
    if (!key) {
      console.warn('Google Maps API key not found');
    } else {
      console.log('Google Maps API key loaded successfully');
    }
  }, []);

  useEffect(() => {
    if (value !== inputValue) {
      setInputValue(value || '');
    }
  }, [value]);

  const searchPlaces = async (query: string) => {
    if (!query.trim() || query.length < 1 || !apiKey) {
      setPredictions([]);
      return;
    }

    setLoading(true);
    try {
      console.log('Searching places for:', query, 'with API key:', apiKey ? 'present' : 'missing');
      
      // Use legacy Places API since it's more reliable
      await searchPlacesLegacy(query);
      
    } catch (error) {
      console.error('Places API error:', error);
      setPredictions([]);
    } finally {
      setLoading(false);
    }
  };

  // Fallback to legacy Places API - optimized for driver navigation
  const searchPlacesLegacy = async (query: string) => {
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(query)}&key=${apiKey}&types=geocode&components=country:us&language=en`
    );

    if (!response.ok) {
      throw new Error(`Legacy API request failed: ${response.status}`);
    }

    const data = await response.json();
    console.log('Legacy Places API response:', data);

    if (data.predictions && Array.isArray(data.predictions)) {
      // Sort predictions to prioritize street addresses
      const sortedPredictions = data.predictions.sort((a: any, b: any) => {
        const aIsStreet = a.types.includes('street_address') || a.types.includes('route');
        const bIsStreet = b.types.includes('street_address') || b.types.includes('route');
        
        if (aIsStreet && !bIsStreet) return -1;
        if (!aIsStreet && bIsStreet) return 1;
        return 0;
      });
      
      setPredictions(sortedPredictions);
    } else {
      setPredictions([]);
    }
  };

  const getPlaceDetails = async (placeId: string) => {
    if (!apiKey) return null;

    try {
      console.log('Getting place details for:', placeId);
      
      // Try new Places API first
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${placeId}`,
        {
          method: 'GET',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'id,formattedAddress,location,addressComponents,types',
          },
        }
      );

      if (!response.ok) {
        console.log('New API failed, trying legacy API...');
        throw new Error(`Place details request failed: ${response.status}`);
      }

      const data = await response.json();
      console.log('Place details response:', data);
      
      return {
        formatted_address: data.formattedAddress,
        geometry: {
          location: {
            lat: data.location.latitude,
            lng: data.location.longitude,
          },
        },
        address_components: data.addressComponents?.map((component: any) => ({
          long_name: component.longText,
          short_name: component.shortText,
          types: component.types,
        })) || [],
        place_id: data.id,
      };
    } catch (error) {
      console.warn('New Places API failed, trying legacy:', error);
      
      // Fallback to legacy Places API
      try {
        const legacyResponse = await fetch(
          `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${apiKey}&fields=formatted_address,geometry,address_components,place_id`
        );

        if (!legacyResponse.ok) {
          throw new Error(`Legacy place details request failed: ${legacyResponse.status}`);
        }

        const legacyData = await legacyResponse.json();
        console.log('Legacy place details response:', legacyData);

        if (legacyData.result) {
          return legacyData.result;
        } else {
          throw new Error('No result in legacy response');
        }
      } catch (legacyError) {
        console.error('Legacy place details also failed:', legacyError);
        return null;
      }
    }
  };

  const handleInputChange = (text: string) => {
    setInputValue(text);
    
    // Show predictions immediately when user starts typing
    if (text.length >= 1) {
      setShowPredictions(true);
    } else {
      setShowPredictions(false);
      setPredictions([]);
    }

    // Clear previous debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Only search if text is long enough
    if (text.length >= 1) {
      // Shorter debounce for better UX
      debounceRef.current = setTimeout(() => {
        searchPlaces(text);
      }, 100); // Reduced from 150ms to 100ms for faster response
    }

    // Call the callback with manual input
    onLocationSelect(text, undefined, undefined);
  };

  const handleInputFocus = () => {
    if (inputValue.length >= 1 && predictions.length > 0) {
      setShowPredictions(true);
    } else if (inputValue.length >= 1) {
      // Trigger search immediately on focus if there's text
      searchPlaces(inputValue);
      setShowPredictions(true);
    }
  };

  const handleInputBlur = () => {
    // Delay hiding predictions to allow for selection
    setTimeout(() => {
      setShowPredictions(false);
    }, 200);
  };

  const handlePlaceSelect = async (prediction: PlacePrediction) => {
    setInputValue(prediction.description);
    setShowPredictions(false);
    setPredictions([]);

    // Get detailed place information
    const details = await getPlaceDetails(prediction.place_id);
    
    if (details) {
      onLocationSelect(
        details.formatted_address,
        {
          lat: details.geometry.location.lat,
          lng: details.geometry.location.lng,
        },
        details
      );
    } else {
      onLocationSelect(prediction.description, undefined, undefined);
    }
  };

  const renderPrediction = (prediction: PlacePrediction, index: number) => {
    const isStreetAddress = prediction.types?.includes('street_address') || 
                           prediction.types?.includes('premise') || 
                           prediction.types?.includes('subpremise');
    
    return (
      <TouchableOpacity
        key={prediction.place_id}
        style={[
          styles.predictionItem,
          isStreetAddress && styles.streetAddressItem,
          index === predictions.length - 1 && styles.lastPredictionItem,
        ]}
        onPress={() => handlePlaceSelect(prediction)}
      >
        <View style={styles.predictionContent}>
          <MaterialIcons 
            name={isStreetAddress ? "location-on" : "place"} 
            size={18} 
            color={isStreetAddress ? "#1E88E5" : "#666"} 
            style={styles.predictionIcon}
          />
          <View style={styles.predictionText}>
            <Text style={[
              styles.predictionMainText,
              isStreetAddress && styles.streetAddressMainText
            ]}>
              {prediction.structured_formatting.main_text}
            </Text>
            {prediction.structured_formatting.secondary_text ? (
              <Text style={styles.predictionSecondaryText}>
                {prediction.structured_formatting.secondary_text}
              </Text>
            ) : null}
          </View>
          {isStreetAddress && (
            <View style={styles.preciseIndicator}>
              <Text style={styles.preciseText}>PRECISE</Text>
            </View>
          )}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>

      <View style={styles.inputContainer}>
        <TextInput
          style={[
            styles.textInput,
            error && styles.inputError,
            disabled && styles.disabledInput,
          ]}
          placeholder={placeholder}
          value={inputValue}
          onChangeText={handleInputChange}
          onFocus={handleInputFocus}
          onBlur={handleInputBlur}
          placeholderTextColor="#999"
          editable={!disabled}
          autoCapitalize="words"
          autoCorrect={false}
          autoComplete="street-address"
        />
        
        {loading && (
          <ActivityIndicator 
            size="small" 
            color="#1E88E5" 
            style={styles.loadingIndicator}
          />
        )}
      </View>

      {showPredictions && (
        <View style={styles.predictionsContainer}>
          {loading && (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color="#1E88E5" />
              <Text style={styles.loadingText}>Searching addresses...</Text>
            </View>
          )}
          
          {!loading && predictions.length > 0 && (
            <ScrollView 
              style={styles.predictionsList}
              keyboardShouldPersistTaps="handled"
              nestedScrollEnabled={true}
              showsVerticalScrollIndicator={false}
            >
              {predictions.map((prediction, index) => 
                renderPrediction(prediction, index)
              )}
            </ScrollView>
          )}
          
          {!loading && predictions.length === 0 && inputValue.length >= 2 && (
            <View style={styles.noResultsContainer}>
              <MaterialIcons name="location-off" size={20} color="#999" />
              <Text style={styles.noResultsText}>
                No addresses found for "{inputValue}"
              </Text>
              <Text style={styles.noResultsSubtext}>
                Try typing a more specific address
              </Text>
            </View>
          )}
        </View>
      )}

      {helper && !error && (
        <Text style={styles.helper}>{helper}</Text>
      )}

      {error && (
        <Text style={styles.error}>{error}</Text>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    marginBottom: 20,
    zIndex: 1,
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
  inputContainer: {
    position: 'relative',
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingRight: 50,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  inputError: {
    borderColor: '#E53E3E',
  },
  disabledInput: {
    backgroundColor: '#F5F5F5',
    color: '#999',
  },
  loadingIndicator: {
    position: 'absolute',
    right: 16,
    top: 15,
  },
  predictionsContainer: {
    position: 'absolute',
    top: 58,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderRadius: 8,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    zIndex: 1000,
    maxHeight: 300,
  },
  predictionsList: {
    maxHeight: 300,
  },
  predictionItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  streetAddressItem: {
    backgroundColor: '#F8F9FF',
  },
  lastPredictionItem: {
    borderBottomWidth: 0,
  },
  predictionContent: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  predictionIcon: {
    marginRight: 12,
  },
  predictionText: {
    flex: 1,
  },
  predictionMainText: {
    fontSize: 16,
    color: '#333',
    fontWeight: '500',
  },
  streetAddressMainText: {
    color: '#1E88E5',
    fontWeight: '600',
  },
  predictionSecondaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
  preciseIndicator: {
    backgroundColor: '#4CAF50',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
  },
  preciseText: {
    color: '#fff',
    fontSize: 10,
    fontWeight: 'bold',
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
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    justifyContent: 'center',
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  noResultsContainer: {
    alignItems: 'center',
    padding: 20,
  },
  noResultsText: {
    fontSize: 14,
    color: '#666',
    marginTop: 8,
    textAlign: 'center',
  },
  noResultsSubtext: {
    fontSize: 12,
    color: '#999',
    marginTop: 4,
    textAlign: 'center',
  },
});

export default PreciseLocationInput;