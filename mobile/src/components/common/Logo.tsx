import React from 'react';
import { Image, ImageSourcePropType } from 'react-native';

interface LogoProps {
  variant?: 'primary' | 'white' | 'icon';
  size?: 'small' | 'medium' | 'large' | 'xlarge';
  style?: any;
}

const LOGO_SIZES = {
  small: { width: 120, height: 36 },
  medium: { width: 160, height: 48 },
  large: { width: 200, height: 60 },
  xlarge: { width: 280, height: 84 },
};

const ICON_SIZES = {
  small: { width: 40, height: 40 },
  medium: { width: 60, height: 60 },
  large: { width: 80, height: 80 },
  xlarge: { width: 120, height: 120 },
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
