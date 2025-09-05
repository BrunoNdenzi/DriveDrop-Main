import React, { Component, ErrorInfo, ReactNode } from 'react';
import { View, Text, StyleSheet, ScrollView, Button } from 'react-native';
import { Colors } from '../constants/Colors';
import * as Sentry from '@sentry/react-native';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: string;
}

class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: '',
    };
  }

  static getDerivedStateFromError(error: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true, error, errorInfo: '' };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    // Log the error to Sentry
    Sentry.withScope(scope => {
      scope.setExtra('componentStack', errorInfo.componentStack);
      Sentry.captureException(error);
    });
    
    console.error('Error caught by ErrorBoundary:', error, errorInfo);
    this.setState({
      errorInfo: errorInfo.componentStack || '',
    });
  }

  resetError = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: '',
    });
  };

  render() {
    if (this.state.hasError) {
      const errorMessage = this.state.error?.toString() || 'An unknown error occurred';
      
      return (
        <View style={styles.container}>
          <Text style={styles.title}>Something went wrong</Text>
          <ScrollView style={styles.errorContainer}>
            <Text style={styles.errorText}>{errorMessage}</Text>
            {this.state.errorInfo && (
              <>
                <Text style={styles.subtitle}>Error Details:</Text>
                <Text style={styles.stackTrace}>{this.state.errorInfo}</Text>
              </>
            )}
          </ScrollView>
          <Button title="Try Again" onPress={this.resetError} color={Colors.primary} />
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: 20,
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginBottom: 16,
  },
  subtitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: Colors.text.primary,
    marginTop: 16,
    marginBottom: 8,
  },
  errorContainer: {
    marginVertical: 16,
    maxHeight: '70%',
  },
  errorText: {
    color: Colors.error,
    fontSize: 16,
    marginBottom: 8,
  },
  stackTrace: {
    color: Colors.text.secondary,
    fontSize: 12,
    fontFamily: 'monospace',
  },
});

export default ErrorBoundary;
