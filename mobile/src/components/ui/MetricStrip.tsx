/**
 * MetricStrip — Enterprise Operations component (React Native)
 *
 * Horizontal strip of key operational metrics. Designed for dashboard tops
 * and section headers to convey system state at a glance.
 *
 * Usage:
 *   <MetricStrip
 *     metrics={[
 *       { label: 'Active Shipments', value: 42 },
 *       { label: 'Pending Pickup', value: 8, variant: 'warning' },
 *       { label: 'Delivered Today', value: 15, variant: 'success' },
 *     ]}
 *   />
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  Colors,
  NeutralColors,
  SemanticColors,
  Typography,
  Spacing,
  ComponentTokens,
  BorderRadius,
} from '../../constants/DesignSystem';

export type MetricVariant = 'default' | 'success' | 'warning' | 'error' | 'info';

export interface MetricItem {
  /** Short label (e.g. "Active Shipments") */
  label: string;
  /** Numeric or string value */
  value: string | number;
  /** Optional color variant for the value */
  variant?: MetricVariant;
  /** Optional unit suffix (e.g. "mi", "%") */
  suffix?: string;
}

interface MetricStripProps {
  metrics: MetricItem[];
  style?: ViewStyle;
}

const valueColorMap: Record<MetricVariant, string> = {
  default: Colors.text.primary,
  success: SemanticColors.success[600],
  warning: SemanticColors.warning[600],
  error: SemanticColors.error[600],
  info: SemanticColors.info[600],
};

export function MetricStrip({ metrics, style }: MetricStripProps) {
  return (
    <View style={[styles.strip, style]}>
      {metrics.map((metric, index) => (
        <React.Fragment key={metric.label}>
          {index > 0 && <View style={styles.divider} />}
          <View style={styles.metric}>
            <Text style={styles.label} numberOfLines={1}>
              {metric.label}
            </Text>
            <Text
              style={[
                styles.value,
                { color: valueColorMap[metric.variant || 'default'] },
              ]}
              numberOfLines={1}
            >
              {metric.value}
              {metric.suffix ? (
                <Text style={styles.suffix}> {metric.suffix}</Text>
              ) : null}
            </Text>
          </View>
        </React.Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    alignItems: 'stretch',
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: NeutralColors.gray[200],
    paddingVertical: ComponentTokens.metricStrip.padding,
    paddingHorizontal: ComponentTokens.metricStrip.padding,
  },
  metric: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing[2],
  },
  divider: {
    width: 1,
    backgroundColor: NeutralColors.gray[200],
    marginVertical: Spacing[1],
  },
  label: {
    fontSize: Typography.fontSize.xs,
    fontWeight: Typography.fontWeight.medium as TextStyle['fontWeight'],
    color: NeutralColors.gray[500],
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 2,
  },
  value: {
    fontSize: Typography.fontSize.lg,
    fontWeight: Typography.fontWeight.semibold as TextStyle['fontWeight'],
    color: Colors.text.primary,
    fontVariant: ['tabular-nums'],
  },
  suffix: {
    fontSize: Typography.fontSize.sm,
    fontWeight: Typography.fontWeight.normal as TextStyle['fontWeight'],
    color: NeutralColors.gray[400],
  },
});

export default MetricStrip;
