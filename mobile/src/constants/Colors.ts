/**
 * DriveDrop design system colors following a modern, clean aesthetic
 * Updated to match Looka brand identity
 */
export const Colors = {
  // Main colors - Matching Looka teal/turquoise brand
  primary: '#00B8A9', // DriveDrop teal (matches Looka logo)
  primaryDark: '#008C7F',
  primaryLight: '#5CD6CA',
  secondary: '#FF9800', // DriveDrop orange
  secondaryDark: '#F57C00',
  secondaryLight: '#FFB74D',

  // Neutral palette
  background: '#F7F9FC',
  surface: '#FFFFFF',
  border: '#E1E8ED',
  white: '#FFFFFF',
  black: '#000000',
  
  // Text colors
  text: {
    primary: '#263238',
    secondary: '#607D8B',
    disabled: '#9E9E9E',
    inverse: '#FFFFFF',
  },

  // Status colors
  success: '#4CAF50',
  warning: '#FF9800',
  error: '#F44336',
  info: '#2196F3',
  
  // Shipment status colors
  status: {
    pending: '#FFB74D', // Orange
    accepted: '#5CD6CA', // Light Teal
    picked_up: '#5CD6CA', // Light Teal
    in_transit: '#00B8A9', // Teal
    delivered: '#81C784', // Light Green
    cancelled: '#E57373', // Light Red
  },

  // Light theme (for compatibility)
  light: {
    background: '#F7F9FC',
    cardBackground: '#FFFFFF',
    surface: '#FFFFFF',
    border: '#E1E8ED',
    text: '#263238',
    textSecondary: '#607D8B',
    textDisabled: '#9E9E9E',
    primary: '#00B8A9',
    secondary: '#FF9800',
    success: '#4CAF50',
    warning: '#FF9800',
    error: '#F44336',
    info: '#2196F3',
  },

  // Dark mode (for future implementation)
  dark: {
    background: '#000000',
    surface: '#1C1C1E',
    border: '#38383A',
    text: {
      primary: '#FFFFFF',
      secondary: '#8E8E93',
      disabled: '#48484A',
    },
  },
} as const;

export type ColorKeys = keyof typeof Colors;

// Theme colors for backward compatibility - flattened structure
export const ThemeColors = {
  primary: Colors.primary,
  primaryDark: Colors.primaryDark,
  primaryLight: Colors.primaryLight,
  secondary: Colors.secondary,
  secondaryDark: Colors.secondaryDark,
  secondaryLight: Colors.secondaryLight,
  background: Colors.background,
  backgroundSecondary: Colors.surface, // Using surface as secondary background
  surface: Colors.surface,
  border: Colors.border,
  text: Colors.text.primary,
  textSecondary: Colors.text.secondary,
  textDisabled: Colors.text.disabled,
  textInverse: Colors.text.inverse,
  success: Colors.success,
  warning: Colors.warning,
  error: Colors.error,
  danger: Colors.error, // Alias for error
  info: Colors.info,
} as const;

// Default theme export
export const defaultTheme = 'light' as const;
