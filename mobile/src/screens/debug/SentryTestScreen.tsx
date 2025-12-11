import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as Sentry from '@sentry/react-native';
import { Colors } from '../../constants/Colors';
import { RootStackParamList } from '../../navigation/types';

type SentryTestScreenProps = NativeStackScreenProps<RootStackParamList, 'SentryTest'>;

export default function SentryTestScreen({ navigation }: SentryTestScreenProps) {
  const testMessage = () => {
    Sentry.captureMessage('✅ Test Message: Sentry is working!', 'info');
    Alert.alert(
      'Success',
      'Test message sent to Sentry!\n\nCheck your Sentry dashboard under Issues to see this message.'
    );
  };

  const testWarning = () => {
    Sentry.captureMessage('⚠️ Warning: This is a test warning', 'warning');
    Alert.alert(
      'Warning Sent',
      'Test warning sent to Sentry!\n\nThis will appear as a warning-level issue.'
    );
  };

  const testError = () => {
    try {
      throw new Error('Test Error: Caught and logged to Sentry');
    } catch (error) {
      Sentry.captureException(error);
      Alert.alert(
        'Error Captured',
        'Test error caught and sent to Sentry!\n\nThe app continues running normally.\n\nCheck Sentry dashboard to see the error with stack trace.'
      );
    }
  };

  const testErrorWithContext = () => {
    try {
      // Add breadcrumb before error
      Sentry.addBreadcrumb({
        category: 'test',
        message: 'User clicked test button with context',
        level: 'info',
        data: {
          timestamp: new Date().toISOString(),
          screen: 'SentryTest',
        },
      });

      throw new Error('Test Error with Context: This error has breadcrumbs and extra data');
    } catch (error) {
      Sentry.captureException(error, {
        tags: {
          test_type: 'manual',
          environment: 'development',
        },
        extra: {
          userAction: 'Clicked test button',
          timestamp: new Date().toISOString(),
        },
      });
      Alert.alert(
        'Error with Context Sent',
        'Error sent with breadcrumbs and extra context!\n\nCheck Sentry to see the rich error details.'
      );
    }
  };

  const testCrash = () => {
    Alert.alert(
      '⚠️ Warning',
      'This will crash the app!\n\nThe app will restart automatically.\n\nThe error will be sent to Sentry when the app restarts.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Crash App',
          style: 'destructive',
          onPress: () => {
            // Wait a moment so alert can close
            setTimeout(() => {
              throw new Error('💥 Test Crash: This is an unhandled error that crashes the app');
            }, 100);
          },
        },
      ]
    );
  };

  const testNetworkError = () => {
    fetch('https://httpstat.us/500')
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Network Error: ${response.status} ${response.statusText}`);
        }
      })
      .catch((error) => {
        Sentry.captureException(error, {
          tags: { error_type: 'network' },
          extra: { url: 'https://httpstat.us/500' },
        });
        Alert.alert(
          'Network Error Captured',
          'Simulated network error sent to Sentry!'
        );
      });
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🔍 Sentry Test Screen</Text>
        <Text style={styles.subtitle}>
          Test error tracking and monitoring
        </Text>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Basic Tests</Text>

        <TouchableOpacity style={styles.button} onPress={testMessage}>
          <Text style={styles.buttonIcon}>✉️</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Send Test Message</Text>
            <Text style={styles.buttonSubtext}>Info level - safe</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testWarning}>
          <Text style={styles.buttonIcon}>⚠️</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Send Warning</Text>
            <Text style={styles.buttonSubtext}>Warning level - safe</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testError}>
          <Text style={styles.buttonIcon}>🚨</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Throw Caught Error</Text>
            <Text style={styles.buttonSubtext}>Error logged, app continues</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Advanced Tests</Text>

        <TouchableOpacity style={styles.button} onPress={testErrorWithContext}>
          <Text style={styles.buttonIcon}>📋</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Error with Context</Text>
            <Text style={styles.buttonSubtext}>Includes breadcrumbs & tags</Text>
          </View>
        </TouchableOpacity>

        <TouchableOpacity style={styles.button} onPress={testNetworkError}>
          <Text style={styles.buttonIcon}>🌐</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Network Error</Text>
            <Text style={styles.buttonSubtext}>Simulated API failure</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Destructive Tests</Text>

        <TouchableOpacity style={[styles.button, styles.dangerButton]} onPress={testCrash}>
          <Text style={styles.buttonIcon}>💥</Text>
          <View style={styles.buttonContent}>
            <Text style={styles.buttonText}>Crash App</Text>
            <Text style={styles.buttonSubtext}>⚠️ Will restart app</Text>
          </View>
        </TouchableOpacity>
      </View>

      <View style={styles.footer}>
        <Text style={styles.footerText}>
          After testing, check your Sentry dashboard to see the captured events
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    padding: 24,
    alignItems: 'center',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
  section: {
    padding: 16,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  dangerButton: {
    backgroundColor: '#FFE5E5',
    borderWidth: 2,
    borderColor: Colors.error,
  },
  buttonIcon: {
    fontSize: 32,
    marginRight: 16,
  },
  buttonContent: {
    flex: 1,
  },
  buttonText: {
    fontSize: 17,
    fontWeight: '600',
    color: Colors.text.primary,
    marginBottom: 4,
  },
  buttonSubtext: {
    fontSize: 13,
    color: Colors.text.secondary,
  },
  footer: {
    padding: 24,
    marginTop: 'auto',
  },
  footerText: {
    fontSize: 14,
    color: Colors.text.secondary,
    textAlign: 'center',
    lineHeight: 20,
  },
});
