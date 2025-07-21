import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Typography, Spacing, BorderRadius, ComponentTokens } from '../../constants/DesignSystem';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export const TestInputScreen: React.FC = () => {
  const [basicValue, setBasicValue] = useState('');
  const [customValue, setCustomValue] = useState('');

  const handleBasicChange = (text: string) => {
    console.log('Basic input changed:', text);
    setBasicValue(text);
  };

  const handleCustomChange = (text: string) => {
    console.log('Custom input changed:', text);
    setCustomValue(text);
  };

  const showValues = () => {
    Alert.alert(
      'Current Values',
      `Basic: "${basicValue}"\nCustom: "${customValue}"`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.title}>Input Test Screen</Text>
        
        <Text style={styles.subtitle}>Basic React Native TextInput:</Text>
        <TextInput
          style={styles.basicInput}
          placeholder="Type here..."
          value={basicValue}
          onChangeText={handleBasicChange}
          autoCapitalize="none"
          autoCorrect={false}
        />
        <Text style={styles.valueText}>Value: "{basicValue}"</Text>

        <Text style={styles.subtitle}>Custom Input Component:</Text>
        <Input
          label="Custom Input"
          placeholder="Type here..."
          value={customValue}
          onChangeText={handleCustomChange}
          leftIcon="edit"
        />
        <Text style={styles.valueText}>Value: "{customValue}"</Text>

        <Button
          title="Show Values"
          onPress={showValues}
          style={styles.button}
        />
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    padding: Spacing[6],
  },
  title: {
    fontSize: Typography.fontSize['2xl'],
    fontWeight: Typography.fontWeight.bold,
    color: Colors.text.primary,
    marginBottom: Spacing[6],
    textAlign: 'center',
  },
  subtitle: {
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    marginTop: Spacing[6],
    marginBottom: Spacing[4],
    fontWeight: Typography.fontWeight.semibold,
  },
  basicInput: {
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    padding: Spacing[4],
    backgroundColor: Colors.surface,
    fontSize: 16,
    color: Colors.text.primary,
  },
  valueText: {
    fontSize: Typography.fontSize.sm,
    color: Colors.text.secondary,
    marginTop: Spacing[2],
    fontStyle: 'italic',
  },
  button: {
    marginTop: Spacing[8],
  },
});
