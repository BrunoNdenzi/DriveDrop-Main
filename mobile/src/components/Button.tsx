import React from 'react';
import {
  StyleSheet,
  Text,
  TouchableOpacity,
  ActivityIndicator,
  View,
  TextStyle,
  ViewStyle,
} from 'react-native';
import { Colors } from '../constants/Colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline' | 'danger';
  size?: 'small' | 'medium' | 'large';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
  fullWidth?: boolean;
  testID?: string;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  size = 'medium',
  disabled = false,
  loading = false,
  style,
  textStyle,
  fullWidth = false,
  testID,
}: ButtonProps) {
  const buttonColors = {
    primary: {
      background: Colors.primary,
      text: '#FFFFFF',
      disabledBackground: Colors.primaryLight,
    },
    secondary: {
      background: Colors.surface,
      text: Colors.text.primary,
      disabledBackground: Colors.border,
    },
    outline: {
      background: 'transparent',
      text: Colors.primary,
      disabledBackground: 'transparent',
    },
    danger: {
      background: Colors.error,
      text: '#FFFFFF',
      disabledBackground: '#F8A5AD',
    },
  };

  const buttonSizes = {
    small: {
      paddingVertical: 8,
      paddingHorizontal: 16,
      fontSize: 14,
    },
    medium: {
      paddingVertical: 12,
      paddingHorizontal: 20,
      fontSize: 16,
    },
    large: {
      paddingVertical: 16,
      paddingHorizontal: 24,
      fontSize: 18,
    },
  };

  const buttonStyle = [
    styles.button,
    {
      backgroundColor: disabled
        ? buttonColors[variant].disabledBackground
        : buttonColors[variant].background,
      paddingVertical: buttonSizes[size].paddingVertical,
      paddingHorizontal: buttonSizes[size].paddingHorizontal,
    },
    variant === 'outline' && {
      borderWidth: 1,
      borderColor: disabled ? Colors.text.disabled : Colors.primary,
    },
    fullWidth && styles.fullWidth,
    style,
  ];

  const textStyleArray = [
    styles.text,
    {
      color: disabled ? Colors.text.disabled : buttonColors[variant].text,
      fontSize: buttonSizes[size].fontSize,
    },
    textStyle,
  ];

  return (
    <TouchableOpacity
      style={buttonStyle}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
      testID={testID}
    >
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === 'outline' ? Colors.primary : '#FFFFFF'}
        />
      ) : (
        <Text style={textStyleArray}>{title}</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    fontWeight: '600',
  },
  fullWidth: {
    width: '100%',
  },
});
