import React from 'react';
import {
  TextInput,
  View,
  Text,
  StyleSheet,
  TextInputProps,
  ViewStyle,
  TextStyle,
  TouchableOpacity,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { Colors, ComponentTokens, Typography, BorderRadius, Spacing } from '../../constants/DesignSystem';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  helper?: string;
  leftIcon?: keyof typeof MaterialIcons.glyphMap;
  rightIcon?: keyof typeof MaterialIcons.glyphMap;
  onRightIconPress?: () => void;
  containerStyle?: ViewStyle;
  inputStyle?: TextStyle;
  required?: boolean;
}

export function Input({
  label,
  error,
  helper,
  leftIcon,
  rightIcon,
  onRightIconPress,
  containerStyle,
  inputStyle,
  required = false,
  ...props
}: InputProps) {
  const hasError = !!error;

  return (
    <View style={[styles.container, containerStyle]}>
      {label && (
        <Text style={styles.label}>
          {label}
          {required && <Text style={styles.required}> *</Text>}
        </Text>
      )}
      
      <View style={[styles.inputContainer, hasError && styles.inputError]}>
        {leftIcon && (
          <MaterialIcons
            name={leftIcon}
            size={20}
            color={Colors.text.secondary}
            style={styles.leftIcon}
          />
        )}
        
        <TextInput
          style={[
            styles.input,
            leftIcon && styles.inputWithLeftIcon,
            rightIcon && styles.inputWithRightIcon,
            inputStyle,
          ]}
          placeholderTextColor={Colors.text.disabled}
          {...props}
        />
        
        {rightIcon && (
          <TouchableOpacity onPress={onRightIconPress} style={styles.rightIcon}>
            <MaterialIcons
              name={rightIcon}
              size={20}
              color={Colors.text.secondary}
            />
          </TouchableOpacity>
        )}
      </View>
      
      {(error || helper) && (
        <Text style={[styles.helper, hasError && styles.helperError]}>
          {error || helper}
        </Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: Spacing[4],
  },
  label: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.medium,
    color: Colors.text.primary,
    marginBottom: Spacing[2],
  },
  required: {
    color: Colors.error,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.md,
    height: ComponentTokens.input.height.base,
  },
  inputError: {
    borderColor: Colors.error,
  },
  input: {
    flex: 1,
    fontSize: Typography.fontSize.base,
    color: Colors.text.primary,
    paddingHorizontal: ComponentTokens.input.padding.horizontal,
    paddingVertical: ComponentTokens.input.padding.vertical,
  },
  inputWithLeftIcon: {
    paddingLeft: Spacing[2],
  },
  inputWithRightIcon: {
    paddingRight: Spacing[2],
  },
  leftIcon: {
    marginLeft: Spacing[3],
  },
  rightIcon: {
    marginRight: Spacing[3],
  },
  helper: {
    fontSize: Typography.fontSize.xs,
    color: Colors.text.secondary,
    marginTop: Spacing[1],
  },
  helperError: {
    color: Colors.error,
  },
});
