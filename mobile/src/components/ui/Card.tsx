import React from 'react';
import {
  View,
  StyleSheet,
  ViewStyle,
  TouchableOpacity,
  TouchableOpacityProps,
} from 'react-native';
import {
  Colors,
  ComponentTokens,
  Shadows,
} from '../../constants/DesignSystem';

interface CardProps extends TouchableOpacityProps {
  children: React.ReactNode;
  variant?: 'default' | 'elevated' | 'outlined';
  padding?: 'sm' | 'base' | 'lg';
  style?: ViewStyle;
  touchable?: boolean;
}

export function Card({
  children,
  variant = 'default',
  padding = 'base',
  style,
  touchable = false,
  ...props
}: CardProps) {
  const cardStyle = [
    styles.base,
    styles[variant],
    styles[`${padding}Padding`],
    style,
  ];

  if (touchable) {
    return (
      <TouchableOpacity style={cardStyle} activeOpacity={0.8} {...props}>
        {children}
      </TouchableOpacity>
    );
  }

  return <View style={cardStyle}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    backgroundColor: Colors.surface,
    borderRadius: ComponentTokens.card.borderRadius,
  },

  // TODO: These styles are used dynamically via styles[variant] but ESLint doesn't detect them
  // Variants
  default: {
    ...Shadows.sm,
  },
  elevated: {
    ...Shadows.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.border,
  },

  // TODO: These styles are used dynamically via styles[`${padding}Padding`] but ESLint doesn't detect them
  // Padding variants
  smPadding: {
    padding: ComponentTokens.card.padding.sm,
  },
  basePadding: {
    padding: ComponentTokens.card.padding.base,
  },
  lgPadding: {
    padding: ComponentTokens.card.padding.lg,
  },
});
