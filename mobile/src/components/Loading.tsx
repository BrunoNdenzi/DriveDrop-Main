import React from 'react';
import { View, StyleSheet, Text, ActivityIndicator, ViewStyle } from 'react-native';
import { Colors } from '../constants/Colors';

interface LoadingProps {
  message?: string;
  fullScreen?: boolean;
  style?: ViewStyle;
}

export function Loading({ message, fullScreen = false, style }: LoadingProps) {
  return (
    <View style={[styles.container, fullScreen && styles.fullScreen, style]}>
      <ActivityIndicator size="large" color={Colors.primary} />
      {message && <Text style={styles.message}>{message}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  fullScreen: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  message: {
    marginTop: 12,
    fontSize: 16,
    color: Colors.text.secondary,
    textAlign: 'center',
  },
});
