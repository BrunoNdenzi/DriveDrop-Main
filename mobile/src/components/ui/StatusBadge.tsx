/**
 * StatusBadge — Enterprise Operations component
 *
 * Renders a compact, state-driven badge for shipment or entity status.
 * Uses StatusColorMap from DesignSystem for consistent operational colors.
 *
 * Usage:
 *   <StatusBadge status="in_transit" />
 *   <StatusBadge status="delivered" label="Complete" />
 *   <StatusBadge status="pending" size="sm" />
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  StatusColorMap,
  ComponentTokens,
  Typography,
  BorderRadius,
  SemanticColors,
  NeutralColors,
  type ShipmentStatus,
} from '../../constants/DesignSystem';

export type BadgeVariant = 'success' | 'warning' | 'error' | 'info' | 'neutral';

interface StatusBadgeProps {
  /** Shipment lifecycle status key — maps to StatusColorMap automatically */
  status?: ShipmentStatus;
  /** Override variant when not using shipment status */
  variant?: BadgeVariant;
  /** Custom label text. Defaults to formatted status string. */
  label?: string;
  /** Badge size */
  size?: 'sm' | 'base';
  /** Optional style override */
  style?: ViewStyle;
  /** Optional text style override */
  textStyle?: TextStyle;
}

const variantColors: Record<BadgeVariant, { bg: string; text: string; border: string }> = {
  success: { bg: SemanticColors.success[50], text: SemanticColors.success[700], border: SemanticColors.success[500] },
  warning: { bg: SemanticColors.warning[50], text: SemanticColors.warning[700], border: SemanticColors.warning[500] },
  error:   { bg: SemanticColors.error[50],   text: SemanticColors.error[700],   border: SemanticColors.error[500] },
  info:    { bg: SemanticColors.info[50],     text: SemanticColors.info[700],    border: SemanticColors.info[500] },
  neutral: { bg: SemanticColors.neutral[50],  text: SemanticColors.neutral[700], border: SemanticColors.neutral[500] },
};

function formatStatusLabel(status: string): string {
  return status
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function StatusBadge({
  status,
  variant,
  label,
  size = 'base',
  style,
  textStyle,
}: StatusBadgeProps) {
  // Resolve colors: status key takes priority, then variant, then neutral fallback
  let colors: { bg: string; text: string; border: string };
  if (status && StatusColorMap[status]) {
    colors = StatusColorMap[status];
  } else if (variant) {
    colors = variantColors[variant];
  } else {
    colors = variantColors.neutral;
  }

  const displayLabel = label || (status ? formatStatusLabel(status) : 'Unknown');
  const isSmall = size === 'sm';

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: colors.bg,
          borderColor: colors.border + '40', // 25% opacity border
        },
        isSmall && styles.badgeSm,
        style,
      ]}
    >
      <View style={[styles.dot, { backgroundColor: colors.border }]} />
      <Text
        style={[
          styles.label,
          { color: colors.text },
          isSmall && styles.labelSm,
          textStyle,
        ]}
        numberOfLines={1}
      >
        {displayLabel}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingHorizontal: ComponentTokens.badge.padding.horizontal,
    paddingVertical: ComponentTokens.badge.padding.vertical,
    borderRadius: ComponentTokens.badge.borderRadius,
    borderWidth: 1,
    gap: 4,
  },
  badgeSm: {
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  label: {
    fontSize: ComponentTokens.badge.fontSize,
    fontWeight: Typography.fontWeight.semibold as TextStyle['fontWeight'],
    letterSpacing: 0.2,
  },
  labelSm: {
    fontSize: 10,
  },
});

export default StatusBadge;
