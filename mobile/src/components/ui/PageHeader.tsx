/**
 * PageHeader — Enterprise Operations layout component (React Native)
 *
 * Consistent page-level header: title, optional subtitle, optional right actions.
 * Replaces ad-hoc header patterns across screens.
 *
 * Usage:
 *   <PageHeader title="Shipments" subtitle="12 active" />
 *   <PageHeader
 *     title="Admin Dashboard"
 *     actions={<Button title="Export" onPress={handleExport} size="sm" />}
 *   />
 */
import React from 'react';
import { View, Text, StyleSheet, ViewStyle, TextStyle } from 'react-native';
import {
  Colors,
  NeutralColors,
  Typography,
  Spacing,
  ComponentTokens,
} from '../../constants/DesignSystem';

interface PageHeaderProps {
  /** Page title */
  title: string;
  /** Optional subtitle (e.g., count, date, breadcrumb) */
  subtitle?: string;
  /** Optional right-aligned actions (buttons, icons) */
  actions?: React.ReactNode;
  /** Optional style override */
  style?: ViewStyle;
}

export function PageHeader({ title, subtitle, actions, style }: PageHeaderProps) {
  return (
    <View style={[styles.header, style]}>
      <View style={styles.titleBlock}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        {subtitle ? (
          <Text style={styles.subtitle} numberOfLines={1}>
            {subtitle}
          </Text>
        ) : null}
      </View>
      {actions ? <View style={styles.actions}>{actions}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: ComponentTokens.pageHeader.paddingVertical,
    paddingHorizontal: ComponentTokens.pageHeader.paddingHorizontal,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: NeutralColors.gray[200],
  },
  titleBlock: {
    flex: 1,
    marginRight: Spacing[3],
  },
  title: {
    fontSize: ComponentTokens.pageHeader.titleSize,
    fontWeight: Typography.fontWeight.semibold as TextStyle['fontWeight'],
    color: Colors.text.primary,
    letterSpacing: -0.3,
  },
  subtitle: {
    fontSize: ComponentTokens.pageHeader.subtitleSize,
    color: NeutralColors.gray[500],
    marginTop: 2,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing[2],
  },
});

export default PageHeader;
