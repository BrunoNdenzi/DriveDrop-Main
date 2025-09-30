import React from 'react';
import {
  StyleSheet,
  View,
  Text,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { Colors } from '../../constants/Colors';

interface LoadingOverlayProps {
  visible: boolean;
  message?: string;
}

export default function LoadingOverlay({ visible, message = 'Loading...' }: LoadingOverlayProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          <ActivityIndicator size="large" color={Colors.light.primary} />
          <Text style={styles.message}>{message}</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  container: {
    backgroundColor: Colors.light.cardBackground,
    borderRadius: 12,
    padding: 32,
    alignItems: 'center',
    minWidth: 200,
    elevation: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
  },
  message: {
    fontSize: 16,
    color: Colors.light.text,
    marginTop: 16,
    textAlign: 'center',
  },
});