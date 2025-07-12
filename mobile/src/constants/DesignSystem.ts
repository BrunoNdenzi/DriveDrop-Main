/**
 * DriveDrop Design System - Design Tokens
 * Comprehensive design tokens for consistent UI/UX across the app
 */

// Brand Colors
export const BrandColors = {
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
export const NeutralColors = {
  white: '#FFFFFF',
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
  black: '#000000',
} as const;

// Semantic Colors
export const SemanticColors = {
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
    50: '#FEF3F2',
    100: '#FEE4E2',
    500: '#F04438',
    600: '#D92D20',
    700: '#B42318',
  },
  info: {
    50: '#F0F9FF',
    100: '#E0F2FE',
    500: '#0EA5E9',
    600: '#0284C7',
    700: '#0369A1',
  },
} as const;

// Typography Scale
export const Typography = {
  fontSize: {
    xs: 12,
    sm: 14,
    base: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 30,
    '4xl': 36,
    '5xl': 48,
    '6xl': 60,
  },
  fontWeight: {
    light: '300',
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
    extrabold: '800',
  },
  lineHeight: {
    tight: 1.25,
    snug: 1.375,
    normal: 1.5,
    relaxed: 1.625,
    loose: 2,
  },
  letterSpacing: {
    tighter: -0.5,
    tight: -0.25,
    normal: 0,
    wide: 0.25,
    wider: 0.5,
    widest: 1,
  },
} as const;

// Spacing Scale (in pixels)
export const Spacing = {
  0: 0,
  1: 4,
  2: 8,
  3: 12,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
} as const;

// Border Radius
export const BorderRadius = {
  none: 0,
  xs: 2,
  sm: 4,
  base: 6,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  full: 9999,
} as const;

// Shadows
export const Shadows = {
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 2,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 6,
    elevation: 3,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 6,
    elevation: 4,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 15,
    elevation: 8,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.25,
    shadowRadius: 25,
    elevation: 12,
  },
} as const;

// Animation Durations
export const Duration = {
  fast: 150,
  normal: 300,
  slow: 500,
} as const;

// Z-Index Scale
export const ZIndex = {
  hide: -1,
  auto: 'auto',
  base: 0,
  docked: 10,
  dropdown: 1000,
  sticky: 1100,
  banner: 1200,
  overlay: 1300,
  modal: 1400,
  popover: 1500,
  skipLink: 1600,
  toast: 1700,
  tooltip: 1800,
} as const;

// Component-specific tokens
export const ComponentTokens = {
  button: {
    height: {
      sm: 32,
      base: 44,
      lg: 56,
    },
    padding: {
      sm: { horizontal: Spacing[3], vertical: Spacing[2] },
      base: { horizontal: Spacing[6], vertical: Spacing[3] },
      lg: { horizontal: Spacing[8], vertical: Spacing[4] },
    },
  },
  input: {
    height: {
      sm: 32,
      base: 44,
      lg: 56,
    },
    padding: {
      horizontal: Spacing[4],
      vertical: Spacing[3],
    },
  },
  card: {
    padding: {
      sm: Spacing[4],
      base: Spacing[6],
      lg: Spacing[8],
    },
    borderRadius: BorderRadius.lg,
  },
} as const;

// Updated Colors object for backward compatibility
export const Colors = {
  // Brand colors
  primary: BrandColors.primary[500],
  primaryDark: BrandColors.primary[700],
  primaryLight: BrandColors.primary[300],
  secondary: BrandColors.secondary[500],
  secondaryDark: BrandColors.secondary[700],
  secondaryLight: BrandColors.secondary[300],

  // Background colors
  background: NeutralColors.gray[100],
  surface: NeutralColors.white,
  border: NeutralColors.gray[200],

  // Text colors
  text: {
    primary: NeutralColors.gray[900],
    secondary: NeutralColors.gray[600],
    disabled: NeutralColors.gray[400],
    inverse: NeutralColors.white,
  },

  // Status colors
  success: SemanticColors.success[500],
  warning: SemanticColors.warning[500],
  error: SemanticColors.error[500],
  info: SemanticColors.info[500],

  // Shipment status colors
  status: {
    pending: BrandColors.secondary[400],
    accepted: BrandColors.primary[300],
    picked_up: BrandColors.primary[300],
    in_transit: BrandColors.primary[500],
    delivered: SemanticColors.success[500],
    cancelled: SemanticColors.error[500],
  },

  // Design system colors
  brand: BrandColors,
  neutral: NeutralColors,
  semantic: SemanticColors,
} as const;

export default {
  Colors,
  Typography,
  Spacing,
  BorderRadius,
  Shadows,
  Duration,
  ZIndex,
  ComponentTokens,
};
