import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Alert, TouchableOpacity, ActivityIndicator } from 'react-native';
import colors from '../theme/colors';

// Simple diagnostic screen without external dependencies
export default function NetworkDiagnosticScreen() {
  const [apiUrl, setApiUrl] = useState<string | null>(null);
  const [supabaseUrl, setSupabaseUrl] = useState<string | null>(null);
  const [testing, setTesting] = useState(false);
  const [errorDetails, setErrorDetails] = useState<string | null>(null);

  useEffect(() => {
    // Get environment variables
    setApiUrl(process.env.EXPO_PUBLIC_API_URL || 'Not defined');
    setSupabaseUrl(process.env.EXPO_PUBLIC_SUPABASE_URL || 'Not defined');
  }, []);

  const testApiConnection = async () => {
    if (!process.env.EXPO_PUBLIC_API_URL) {
      setErrorDetails('API URL is not defined in environment variables');
      return;
    }
    
    try {
      setTesting(true);
      setErrorDetails(null);
      
      // Test API connection with health endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/health`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (response.ok) {
        Alert.alert('Success', 'API connection successful!');
      } else {
        const text = await response.text();
        setErrorDetails(`API Error (${response.status}): ${text}`);
        Alert.alert('Error', `API Error (${response.status}): ${text}`);
      }
    } catch (error: any) {
      setErrorDetails(`Network Error: ${error.message}`);
      Alert.alert('Network Error', error.message);
      console.error('API connection error:', error);
    } finally {
      setTesting(false);
    }
  };

  const testDriverApplicationsApi = async () => {
    if (!process.env.EXPO_PUBLIC_API_URL) {
      Alert.alert('Error', 'API URL is not defined in environment variables');
      return;
    }
    
    try {
      setTesting(true);
      setErrorDetails(null);
      
      console.log('Testing driver applications API...');
      console.log('URL:', `${process.env.EXPO_PUBLIC_API_URL}/api/v1/drivers/applications`);
      
      // Test the specific endpoint
      const response = await fetch(`${process.env.EXPO_PUBLIC_API_URL}/api/v1/drivers/applications`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      const contentType = response.headers.get('content-type');
      let result;
      
      try {
        if (contentType && contentType.includes('application/json')) {
          result = await response.json();
        } else {
          const text = await response.text();
          result = { text };
        }
      } catch (e) {
        result = { parseError: (e as Error).message };
      }
      
      Alert.alert(
        response.ok ? 'Success' : 'Error',
        `Status: ${response.status} ${response.statusText}\n\nResponse: ${JSON.stringify(result, null, 2)}`,
      );
    } catch (error: any) {
      Alert.alert('Network Error', error.message);
      console.error('Driver applications API error:', error);
    } finally {
      setTesting(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Network Diagnostic Tool</Text>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Environment</Text>
        <View style={styles.infoRow}>
          <Text style={styles.label}>API URL:</Text>
          <Text style={styles.value}>{apiUrl}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={styles.label}>Supabase URL:</Text>
          <Text style={styles.value}>{supabaseUrl}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Connection Tests</Text>
        
        <TouchableOpacity 
          style={[styles.button, testing ? styles.buttonDisabled : null]}
          onPress={testApiConnection}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Test API Connection</Text>
          )}
        </TouchableOpacity>
        
        <TouchableOpacity 
          style={[styles.button, testing ? styles.buttonDisabled : null]}
          onPress={testDriverApplicationsApi}
          disabled={testing}
        >
          {testing ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Text style={styles.buttonText}>Test Applications API</Text>
          )}
        </TouchableOpacity>
      </View>
      
      {errorDetails && (
        <View style={styles.errorContainer}>
          <Text style={styles.errorTitle}>Error Details:</Text>
          <Text style={styles.errorMessage}>{errorDetails}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
    backgroundColor: colors.tokens.c_f5f5f5,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 24,
    color: '#333',
  },
  section: {
    marginBottom: 24,
    backgroundColor: '#fff',
    padding: 16,
    borderRadius: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
    color: '#333',
  },
  infoRow: {
    flexDirection: 'row',
    marginBottom: 8,
  },
  label: {
    fontWeight: '600',
    marginRight: 8,
    width: 100,
    color: '#666',
  },
  value: {
    flex: 1,
    color: '#333',
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: 8,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  buttonDisabled: {
    backgroundColor: colors.tokens.c_90caf9,
  },
  buttonText: {
    color: colors.white,
    fontWeight: '600',
    fontSize: 14,
  },
  errorContainer: {
    padding: 16,
    backgroundColor: colors.tokens.c_fff5f5,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.tokens.c_e53935,
  },
  errorTitle: {
    fontWeight: 'bold',
    color: colors.tokens.c_e53935,
    marginBottom: 8,
  },
  errorMessage: {
    color: '#333',
  },
});
