/**
 * RobustGooglePlacesInput - A custom Google Places Autocomplete component
 * 
 * This component uses the new Google Places API (Places API New) instead of the legacy API.
 * 
 * Required Google Cloud APIs to enable:
 * 1. Places API (New) - for place search and autocomplete
 * 2. Geocoding API - for coordinate lookups (optional)
 * 
 * Make sure your API key has the following permissions:
 * - Places API (New)
 * - Restrict to your app's package name/bundle ID for security
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
import { getGoogleMapsApiKey } from '../utils/googleMaps';

interface PlacePrediction {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

interface RobustGooglePlacesInputProps {
  label: string;
  placeholder: string;
  value?: string;
  onAddressSelect: (address: string, details?: any) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  googleApiKey?: string;
  style?: any;
  disabled?: boolean;
}

const RobustGooglePlacesInput: React.FC<RobustGooglePlacesInputProps> = ({
  label,
  placeholder = "Enter address",
  value,
  onAddressSelect,
  required = false,
  helper,
  error,
  googleApiKey,
  style,
  disabled = false,
}) => {
  const [predictions, setPredictions] = useState<PlacePrediction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPredictions, setShowPredictions] = useState(false);
  const [apiKey, setApiKey] = useState<string | null>(null);
  const [inputValue, setInputValue] = useState(value || '');
  const debounceRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    const initApiKey = async () => {
      try {
        const key = await getGoogleMapsApiKey();
        setApiKey(key);
      } catch (error) {
        console.warn('Google Maps API key not available:', error);
      }
    };
    initApiKey();
  }, []);

  const fetchPlacePredictions = async (input: string) => {
    if (!apiKey || !input.trim() || input.length < 3) {
      setPredictions([]);
      setShowPredictions(false);
      return;
    }

    setIsLoading(true);
    
    try {
      // Using the new Places API (New) Text Search endpoint
      const requestBody = {
        textQuery: input,
        regionCode: "US",
        maxResultCount: 5,
        locationBias: {
          rectangle: {
            low: {
              latitude: 25.7617,
              longitude: -124.3959
            },
            high: {
              latitude: 49.3457,
              longitude: -66.9346
            }
          }
        }
      };

      const response = await fetch(
        `https://places.googleapis.com/v1/places:searchText`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress,places.addressComponents'
          },
          body: JSON.stringify(requestBody)
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data.places) {
        // Transform the new API response to our expected format
        const safePredictions = (data.places || []).map((place: any) => ({
          place_id: place.id || '',
          description: place.formattedAddress || place.displayName?.text || '',
          structured_formatting: {
            main_text: place.displayName?.text || '',
            secondary_text: place.formattedAddress || '',
          },
        }));
        
        setPredictions(safePredictions);
        setShowPredictions(true);
      } else {
        setPredictions([]);
        setShowPredictions(false);
        if (data.error) {
          console.error('Google Places API error:', data.error.message);
        }
      }
    } catch (error) {
      console.error('Error fetching place predictions:', error);
      setPredictions([]);
      setShowPredictions(false);
    } finally {
      setIsLoading(false);
    }
  };

  const handleTextChange = (text: string) => {
    setInputValue(text);
    onAddressSelect(text, null);
    
    // Clear existing debounce
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }
    
    // Debounce the API call
    debounceRef.current = setTimeout(() => {
      fetchPlacePredictions(text);
    }, 300);
  };

  const handlePlaceSelect = async (prediction: PlacePrediction) => {
    if (!apiKey) return;
    
    setShowPredictions(false);
    setIsLoading(true);
    
    try {
      // Get place details using the new Places API
      const response = await fetch(
        `https://places.googleapis.com/v1/places/${prediction.place_id}`,
        {
          method: 'GET',
          headers: {
            'X-Goog-Api-Key': apiKey,
            'X-Goog-FieldMask': 'addressComponents,formattedAddress,location,displayName'
          }
        }
      );
      
      const data = await response.json();
      
      if (response.ok && data) {
        const address = data.formattedAddress || prediction.description;
        setInputValue(address);
        
        // Extract ZIP code from address components
        let zipCode = '';
        if (data.addressComponents) {
          const zipComponent = data.addressComponents.find((component: any) =>
            component.types?.includes('postal_code')
          );
          zipCode = zipComponent?.longText || '';
        }
        
        const placeData = {
          address,
          zipCode,
          coordinates: data.location,
          placeId: prediction.place_id,
          address_components: data.addressComponents,
        };
        
        onAddressSelect(address, placeData);
      } else {
        // Fallback to just using the description
        setInputValue(prediction.description);
        onAddressSelect(prediction.description, {
          address: prediction.description,
          zipCode: '',
          coordinates: null,
          placeId: prediction.place_id,
        });
      }
    } catch (error) {
      console.error('Error fetching place details:', error);
      // Fallback to just using the description
      setInputValue(prediction.description);
      onAddressSelect(prediction.description, {
        address: prediction.description,
        zipCode: '',
        coordinates: null,
        placeId: prediction.place_id,
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Fallback to regular TextInput if no API key
  if (!apiKey) {
    return (
      <View style={[styles.container, style]}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={styles.textInput}
          value={inputValue}
          onChangeText={(text) => {
            setInputValue(text);
            onAddressSelect(text, null);
          }}
          placeholder={placeholder}
          editable={!disabled}
          multiline
          numberOfLines={3}
        />
        <Text style={styles.fallbackNote}>
          Note: Google Places autocomplete not available
        </Text>
        {helper && <Text style={styles.helper}>{helper}</Text>}
        {error && <Text style={styles.error}>{error}</Text>}
      </View>
    );
  }

  return (
    <View style={[styles.container, style]}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      <TextInput
        style={styles.textInput}
        value={inputValue}
        onChangeText={handleTextChange}
        placeholder={placeholder}
        editable={!disabled}
        onFocus={() => {
          if (inputValue && inputValue.length >= 3) {
            fetchPlacePredictions(inputValue);
          }
        }}
        onBlur={() => {
          // Delay hiding predictions to allow for selection
          setTimeout(() => setShowPredictions(false), 200);
        }}
      />
      
      {isLoading && (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="small" color="#007AFF" />
          <Text style={styles.loadingText}>Searching addresses...</Text>
        </View>
      )}
      
      {showPredictions && predictions.length > 0 && (
        <View style={styles.predictionsContainer}>
          <ScrollView style={styles.predictionsList} keyboardShouldPersistTaps="handled">
            {predictions.map((prediction, index) => (
              <TouchableOpacity
                key={prediction.place_id || index}
                style={styles.predictionItem}
                onPress={() => handlePlaceSelect(prediction)}
              >
                <Text style={styles.predictionMainText}>
                  {prediction.structured_formatting.main_text}
                </Text>
                <Text style={styles.predictionSecondaryText}>
                  {prediction.structured_formatting.secondary_text}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
      
      {helper && <Text style={styles.helper}>{helper}</Text>}
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'relative',
    zIndex: 1000,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    marginBottom: 8,
  },
  required: {
    color: '#E74C3C',
  },
  textInput: {
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#FFFFFF',
    minHeight: 48,
    textAlignVertical: 'top',
  },
  helper: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
  },
  error: {
    fontSize: 12,
    color: '#E74C3C',
    marginTop: 4,
  },
  fallbackNote: {
    fontSize: 12,
    color: '#666',
    marginTop: 4,
    fontStyle: 'italic',
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  loadingText: {
    marginLeft: 8,
    fontSize: 14,
    color: '#666',
  },
  predictionsContainer: {
    position: 'absolute',
    top: '100%',
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderTopWidth: 0,
    borderBottomLeftRadius: 8,
    borderBottomRightRadius: 8,
    elevation: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    maxHeight: 200,
    zIndex: 1001,
  },
  predictionsList: {
    maxHeight: 200,
  },
  predictionItem: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  predictionMainText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  predictionSecondaryText: {
    fontSize: 14,
    color: '#666',
    marginTop: 2,
  },
});

export default RobustGooglePlacesInput;
