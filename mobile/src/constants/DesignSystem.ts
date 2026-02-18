/**
 * DriveDrop Design System - Enterprise Operations Design Tokens
 * 
 * Constitution: Operational clarity, state-driven UI, data density.
 * No decorative gradients. No heavy shadows. No startup SaaS patterns.
 * Every element must answer: What is happening? What requires action?
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

// Semantic / Status Colors — enterprise-grade operational palette
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
  // Operational status tokens (shipment lifecycle)
  neutral: {
    50: '#F8FAFC',
    100: '#F1F5F9',
    500: '#64748B',
    600: '#475569',
    700: '#334155',
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

// Border Radius — Enterprise scale: tight, functional, no pill shapes
export const BorderRadius = {
  none: 0,
  xs: 1,
  sm: 2,
  base: 3,
  md: 4,
  lg: 6,
  xl: 8,
  '2xl': 10,
  '3xl': 12,
  full: 9999,
} as const;

// Shadows — Minimal, structural only. No decorative elevation.
export const Shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.04,
    shadowRadius: 1,
    elevation: 1,
  },
  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 2,
    elevation: 2,
  },
  base: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
    elevation: 2,
  },
  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 3,
  },
  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 4,
  },
  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
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
      base: 40,
      lg: 48,
    },
    padding: {
      sm: { horizontal: Spacing[3], vertical: Spacing[2] },
      base: { horizontal: Spacing[5], vertical: Spacing[3] },
      lg: { horizontal: Spacing[6], vertical: Spacing[4] },
    },
    borderRadius: BorderRadius.md,
  },
  input: {
    height: {
      sm: 32,
      base: 40,
      lg: 48,
    },
    padding: {
      horizontal: Spacing[3],
      vertical: Spacing[2],
    },
    borderRadius: BorderRadius.md,
  },
  card: {
    padding: {
      sm: Spacing[3],
      base: Spacing[4],
      lg: Spacing[6],
    },
    borderRadius: BorderRadius.lg,
  },
  badge: {
    padding: {
      horizontal: Spacing[2],
      vertical: Spacing[1],
    },
    borderRadius: BorderRadius.sm,
    fontSize: Typography.fontSize.xs,
  },
  table: {
    headerHeight: 40,
    rowHeight: 44,
    cellPadding: {
      horizontal: Spacing[3],
      vertical: Spacing[2],
    },
    borderColor: NeutralColors.gray[200],
  },
  metricStrip: {
    padding: Spacing[4],
    gap: Spacing[4],
  },
  pageHeader: {
    paddingVertical: Spacing[4],
    paddingHorizontal: Spacing[4],
    titleSize: Typography.fontSize['xl'],
    subtitleSize: Typography.fontSize.sm,
  },
} as const;

// Shipment lifecycle status map — single source of truth
export const StatusColorMap = {
  pending:       { bg: SemanticColors.warning[50],  text: SemanticColors.warning[700],  border: SemanticColors.warning[500] },
  quote_pending: { bg: SemanticColors.warning[50],  text: SemanticColors.warning[700],  border: SemanticColors.warning[500] },
  accepted:      { bg: SemanticColors.info[50],     text: SemanticColors.info[700],     border: SemanticColors.info[500] },
  assigned:      { bg: SemanticColors.info[50],     text: SemanticColors.info[700],     border: SemanticColors.info[500] },
  picked_up:     { bg: BrandColors.primary[50],     text: BrandColors.primary[800],     border: BrandColors.primary[500] },
  in_transit:    { bg: BrandColors.primary[50],     text: BrandColors.primary[800],     border: BrandColors.primary[500] },
  delivered:     { bg: SemanticColors.success[50],   text: SemanticColors.success[700],  border: SemanticColors.success[500] },
  completed:     { bg: SemanticColors.success[50],   text: SemanticColors.success[700],  border: SemanticColors.success[500] },
  cancelled:     { bg: SemanticColors.error[50],     text: SemanticColors.error[700],    border: SemanticColors.error[500] },
  failed:        { bg: SemanticColors.error[50],     text: SemanticColors.error[700],    border: SemanticColors.error[500] },
  draft:         { bg: SemanticColors.neutral[50],   text: SemanticColors.neutral[700],  border: SemanticColors.neutral[500] },
  expired:       { bg: SemanticColors.neutral[50],   text: SemanticColors.neutral[700],  border: SemanticColors.neutral[500] },
} as const;

export type ShipmentStatus = keyof typeof StatusColorMap;

// Colors object for backward compatibility
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

  // Shipment status colors (backward compat)
  status: {
    pending: SemanticColors.warning[500],
    accepted: SemanticColors.info[500],
    picked_up: BrandColors.primary[500],
    in_transit: BrandColors.primary[600],
    delivered: SemanticColors.success[500],
    cancelled: SemanticColors.error[500],
  },

  // Design system references
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
  StatusColorMap,
};
