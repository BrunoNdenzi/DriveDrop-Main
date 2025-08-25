/**
 * DriveDrop Consolidated Color System
 * Comprehensive color tokens for consistent UI/UX across the mobile app
 */

// Automated color-replacement tokens for common hex values
export const colorTokens = {
  // White variations
  c_ffffff: '#FFFFFF',
  c_white: '#FFFFFF',
  
  // Black variations
  c_000000: '#000000',
  c_black: '#000000',
  
  // Common UI colors
  c_ffd700: '#FFD700', // Gold star color
  c_f8f8f8: '#F8F8F8', // Light background
  c_ececec: '#ECECEC', // Light gray
  c_dcf8c6: '#DCF8C6', // Light green (chat bubble)
  c_007aff: '#007AFF', // iOS blue
  c_0000ff: '#0000FF', // Pure blue
  c_f5f5f5: '#F5F5F5', // Very light gray
  c_fff5f5: '#FFF5F5', // Very light red background
  c_e53935: '#E53935', // Error red
  c_f44336: '#F44336', // Material red
  c_e3f2fd: '#E3F2FD', // Light blue background
  c_90caf9: '#90CAF9', // Light blue
  c_1e88e5: '#1E88E5', // Primary blue
  c_1565c0: '#1565C0', // Dark blue
  c_64b5f6: '#64B5F6', // Light blue
  c_ff9800: '#FF9800', // Orange
  c_f57c00: '#F57C00', // Dark orange
  c_ffb74d: '#FFB74D', // Light orange
  c_4caf50: '#4CAF50', // Green
  c_81c784: '#81C784', // Light green
  c_e57373: '#E57373', // Light red
  c_9e9e9e: '#9E9E9E', // Gray
} as const;

// Brand Colors
export const brandColors = {
  primary: {
    50: '#E3F2FD',
    100: '#BBDEFB',
    200: '#90CAF9',
    300: '#64B5F6',
    400: '#42A5F5',
    500: '#1E88E5', // Main brand blue
    600: '#1976D2',
    700: '#1565C0',
    800: '#0D47A1',
    900: '#0A3A7A',
  },
  secondary: {
    50: '#FFF8E1',
    100: '#FFECB3',
    200: '#FFE082',
    300: '#FFD54F',
    400: '#FFCA28',
    500: '#FF9800', // Main brand orange
    600: '#FB8C00',
    700: '#F57C00',
    800: '#EF6C00',
    900: '#E65100',
  },
} as const;

// Neutral Colors
export const neutralColors = {
  white: colorTokens.c_ffffff,
  gray: {
    50: '#FAFBFC',
    100: '#F7F9FC',
    200: '#E1E8ED',
    300: '#D4DDE4',
    400: '#9FAAB5',
    500: '#667085',
    600: '#475467',
    700: '#344054',
    800: '#1D2939',
    900: '#101828',
  },
  black: colorTokens.c_000000,
} as const;

// Semantic Colors
export const semanticColors = {
  success: {
    50: '#ECFDF3',
    100: '#D1FADF',
    500: '#12B76A',
    600: '#039855',
    700: '#027A48',
  },
  warning: {
    50: '#FFFAEB',
    100: '#FEF0C7',
    500: '#F79009',
    600: '#DC6803',
    700: '#B54708',
  },
  error: {
    50: colorTokens.c_fff5f5,
    100: '#FEE2E2',
    500: '#EF4444',
    600: colorTokens.c_e53935,
    700: '#B91C1C',
  },
  info: {
    50: colorTokens.c_e3f2fd,
    100: '#DBEAFE',
    500: '#3B82F6',
    600: '#2563EB',
    700: '#1D4ED8',
  },
} as const;

// Consolidated Colors object for backward compatibility
export const colors = {
  // Brand colors
  primary: brandColors.primary[500],
  primaryDark: brandColors.primary[700],
  primaryLight: brandColors.primary[300],
  secondary: brandColors.secondary[500],
  secondaryDark: brandColors.secondary[700],
  secondaryLight: brandColors.secondary[300],

  // Background colors
  background: neutralColors.gray[100],
  surface: neutralColors.white,
  border: neutralColors.gray[200],

  // Text colors
  text: {
    primary: neutralColors.gray[900],
    secondary: neutralColors.gray[600],
    disabled: neutralColors.gray[400],
    inverse: neutralColors.white,
  },

  // Status colors
  success: semanticColors.success[500],
  warning: semanticColors.warning[500],
  error: semanticColors.error[500],
  info: semanticColors.info[500],

  // Shipment status colors
  status: {
    pending: brandColors.secondary[400],
    accepted: brandColors.primary[300],
    picked_up: brandColors.primary[300],
    in_transit: brandColors.primary[500],
    delivered: semanticColors.success[500],
    cancelled: semanticColors.error[500],
  },

  // Common UI colors with token aliases
  white: colorTokens.c_ffffff,
  black: colorTokens.c_000000,
  gold: colorTokens.c_ffd700,
  lightGray: colorTokens.c_f8f8f8,
  borderGray: colorTokens.c_ececec,
  chatGreen: colorTokens.c_dcf8c6,
  iosBlue: colorTokens.c_007aff,
  pureBlue: colorTokens.c_0000ff,

  // Dark mode (for future implementation)
  dark: {
    background: colorTokens.c_000000,
    surface: '#1C1C1E',
    border: '#38383A',
    text: {
      primary: colorTokens.c_ffffff,
      secondary: '#8E8E93',
      disabled: '#48484A',
    },
  },

  // Design system colors for advanced usage
  brand: brandColors,
  neutral: neutralColors,
  semantic: semanticColors,
  tokens: colorTokens,
} as const;

// Export individual color systems (already exported above)

// Default export for easy importing
export default colors;

// Type definitions
export type ColorTokens = typeof colorTokens;
export type BrandColors = typeof brandColors;
export type NeutralColors = typeof neutralColors;
export type SemanticColors = typeof semanticColors;
export type Colors = typeof colors;