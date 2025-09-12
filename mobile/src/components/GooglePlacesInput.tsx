import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

interface GooglePlacesInputProps {
  label: string;
  placeholder: string;
  value?: string;
  onAddressSelect: (address: string, details?: any) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  googleApiKey: string;
}

const GooglePlacesInput: React.FC<GooglePlacesInputProps> = ({
  label,
  placeholder,
  value,
  onAddressSelect,
  required = false,
  helper,
  error,
  googleApiKey,
}) => {
  const [hasError, setHasError] = useState(false);
  const [fallbackValue, setFallbackValue] = useState(value || '');

  // Don't render if no API key
  if (!googleApiKey || googleApiKey.trim() === '') {
    console.warn('GooglePlacesInput: No API key provided');
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={styles.fallbackInput}
          placeholder={placeholder}
          value={fallbackValue}
          onChangeText={(text) => {
            setFallbackValue(text);
            onAddressSelect(text, null);
          }}
          placeholderTextColor="#999"
        />
        <Text style={styles.error}>Google Places API key not configured - using fallback input</Text>
      </View>
    );
  }

  // Fallback to regular input if GooglePlaces has errors
  if (hasError) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={styles.fallbackInput}
          placeholder={placeholder}
          value={fallbackValue}
          onChangeText={(text) => {
            setFallbackValue(text);
            onAddressSelect(text, null);
          }}
          placeholderTextColor="#999"
        />
        {helper && !error && (
          <Text style={styles.helper}>{helper} (Using fallback mode)</Text>
        )}
        {error && (
          <Text style={styles.error}>{error}</Text>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      
      <View style={styles.autocompleteContainer}>
        <GooglePlacesAutocomplete
          placeholder={placeholder}
          onPress={(data, details = null) => {
            try {
              // Extract full formatted address
              const fullAddress = details?.formatted_address || data.description;
              onAddressSelect(fullAddress, details);
            } catch (err) {
              console.warn('GooglePlacesInput onPress error:', err);
              // Fallback to basic description
              onAddressSelect(data.description, null);
            }
          }}
          query={{
            key: googleApiKey,
            language: 'en',
            components: 'country:us',
          }}
          fetchDetails={true}
          styles={{
            container: styles.googleContainer,
            textInput: styles.googleTextInput,
            listView: styles.listView,
            row: styles.row,
            description: styles.description,
          }}
          debounce={300}
          enablePoweredByContainer={false}
          onFail={(error) => {
            console.warn('GooglePlacesAutocomplete error:', error);
            setHasError(true);
          }}
          onNotFound={() => {
            console.log('GooglePlacesAutocomplete: No results found');
          }}
          onTimeout={() => {
            console.warn('GooglePlacesAutocomplete: Request timeout');
            setHasError(true);
          }}
        />
      </View>

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
  autocompleteContainer: {
    zIndex: 1,
    flex: 1,
  },
  googleContainer: {
    flex: 0,
  },
  googleTextInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  textInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  fallbackInput: {
    height: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
  },
  listView: {
    backgroundColor: '#fff',
    borderRadius: 8,
    marginTop: 2,
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    maxHeight: 200,
  },
  row: {
    backgroundColor: '#fff',
    padding: 13,
    minHeight: 44,
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  description: {
    fontSize: 14,
    color: '#333',
    flex: 1,
  },
  predefinedPlacesDescription: {
    color: '#1E88E5',
    fontSize: 14,
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
});

export default GooglePlacesInput;
