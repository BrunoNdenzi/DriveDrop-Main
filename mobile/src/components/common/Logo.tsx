import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';

interface LogoProps {
  variant?: 'primary' | 'white' | 'icon';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: any;
}

const LOGO_SIZES = {
  small: { width: 160, height: 48 },
  medium: { width: 220, height: 66 },
  large: { width: 280, height: 84 },
  xlarge: { width: 340, height: 102 },
};

const ICON_SIZES = {
  small: { width: 60, height: 60 },
  medium: { width: 80, height: 80 },
  large: { width: 100, height: 100 },
  xlarge: { width: 140, height: 140 },
};

export default function Logo({ 
  variant = 'primary', 
  size = 'medium',
  style 
}: LogoProps) {
  const getLogoSource = (): ImageSourcePropType => {
    switch (variant) {
      case 'primary':
        return require('../../../assets/logo-primary.png');
      case 'white':
        return require('../../../assets/logo-white.png');
      case 'icon':
        return require('../../../assets/logo-icon-only.png');
      default:
        return require('../../../assets/logo-primary.png');
    }
  };

  const logoSource = getLogoSource();
  const dimensions = variant === 'icon' ? ICON_SIZES[size] : LOGO_SIZES[size];

  return (
    <Image
      source={logoSource}
      style={[dimensions, style]}
      resizeMode="contain"
    />
  );
}
