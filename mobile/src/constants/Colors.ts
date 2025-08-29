/**
 * DriveDrop design system colors following a modern, clean aesthetic
 */
export const Colors = {
  // Main colors
  primary: '#1E88E5', // DriveDrop blue
  primaryDark: '#1565C0',
  primaryLight: '#64B5F6',
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
    accepted: '#64B5F6', // Light Blue
    picked_up: '#64B5F6', // Light Blue
    in_transit: '#1E88E5', // Blue
    delivered: '#81C784', // Light Green
    cancelled: '#E57373', // Light Red
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
