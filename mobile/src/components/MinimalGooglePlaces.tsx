import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

interface MinimalGooglePlacesProps {
  label: string;
  placeholder: string;
  value?: string;
  onAddressSelect: (address: string, details?: any) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  googleApiKey: string;
}

const MinimalGooglePlaces: React.FC<MinimalGooglePlacesProps> = ({
  label,
  placeholder,
  value,
  onAddressSelect,
  required = false,
  helper,
  error,
  googleApiKey,
}) => {
  const [GooglePlacesAutocomplete, setGooglePlacesAutocomplete] = useState<any>(null);
  const [loadError, setLoadError] = useState(false);
  const [fallbackValue, setFallbackValue] = useState(value || '');

  useEffect(() => {
    try {
      // Dynamic import to catch any loading errors
      import('react-native-google-places-autocomplete').then(module => {
        setGooglePlacesAutocomplete(() => module.GooglePlacesAutocomplete);
      }).catch(err => {
        console.warn('Failed to load GooglePlacesAutocomplete:', err);
        setLoadError(true);
      });
    } catch (err) {
      console.warn('Error importing GooglePlacesAutocomplete:', err);
      setLoadError(true);
    }
  }, []);

  // Fallback to simple input if loading failed or no API key
  if (loadError || !googleApiKey || !GooglePlacesAutocomplete) {
    return (
      <View style={styles.container}>
        <Text style={styles.label}>
          {label} {required && <Text style={styles.required}>*</Text>}
        </Text>
        <TextInput
          style={styles.input}
          placeholder={placeholder}
          value={fallbackValue}
          onChangeText={(text) => {
            setFallbackValue(text);
            onAddressSelect(text, null);
          }}
          placeholderTextColor="#999"
          multiline
          numberOfLines={2}
        />
        {helper && (
          <Text style={styles.helper}>{helper} {loadError ? '(Using fallback input)' : ''}</Text>
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
          onPress={(data: any, details: any = null) => {
            try {
              const fullAddress = details?.formatted_address || data.description;
              onAddressSelect(fullAddress, details);
            } catch (err) {
              console.warn('GooglePlaces onPress error:', err);
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
            container: { flex: 0 },
            textInput: styles.googleInput,
            listView: styles.listView,
            row: styles.row,
            description: styles.description,
          }}
          debounce={400}
          enablePoweredByContainer={false}
          onFail={(error: any) => {
            console.warn('GooglePlaces API error:', error);
            setLoadError(true);
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
  input: {
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    backgroundColor: '#fff',
    color: '#333',
    textAlignVertical: 'top',
  },
  googleInput: {
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

export default MinimalGooglePlaces;
