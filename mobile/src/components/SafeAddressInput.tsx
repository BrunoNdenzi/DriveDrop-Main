import React, { useState } from 'react';
import { View, Text, StyleSheet, TextInput } from 'react-native';

interface SafeAddressInputProps {
  label: string;
  placeholder: string;
  value?: string;
  onAddressSelect: (address: string, details?: any) => void;
  required?: boolean;
  helper?: string;
  error?: string;
  googleApiKey?: string;
}

const SafeAddressInput: React.FC<SafeAddressInputProps> = ({
  label,
  placeholder,
  value,
  onAddressSelect,
  required = false,
  helper,
  error,
  googleApiKey,
}) => {
  const [inputValue, setInputValue] = useState(value || '');

  const handleTextChange = (text: string) => {
    setInputValue(text);
    onAddressSelect(text, null);
    
    // Try to extract ZIP code for backward compatibility
    const zipMatch = text.match(/\b\d{5}\b/);
    if (zipMatch) {
      // If it looks like just a ZIP code, we can note that
      console.log('Detected ZIP code:', zipMatch[0]);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.label}>
        {label} {required && <Text style={styles.required}>*</Text>}
      </Text>
      
      <TextInput
        style={styles.input}
        placeholder={placeholder}
        value={inputValue}
        onChangeText={handleTextChange}
        placeholderTextColor="#999"
        multiline
        numberOfLines={3}
        textAlignVertical="top"
        autoCapitalize="words"
        autoCorrect={false}
      />

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
  input: {
    minHeight: 60,
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

export default SafeAddressInput;
