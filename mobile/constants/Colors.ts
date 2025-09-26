// Color constants for the application
export const Colors = {
  light: {
    primary: '#007AFF',
    secondary: '#5856D6',
    success: '#34C759',
    warning: '#FF9500',
    danger: '#FF3B30',
    info: '#5AC8FA',
    
    // Text colors
    text: '#000000',
    textSecondary: '#6B7280',
    textLight: '#9CA3AF',
    
    // Background colors
    background: '#FFFFFF',
    backgroundSecondary: '#F9FAFB',
    backgroundTertiary: '#F3F4F6',
    
    // Border colors
    border: '#E5E7EB',
    borderLight: '#F3F4F6',
    
    // Form colors
    inputBackground: '#FFFFFF',
    inputBorder: '#D1D5DB',
    inputBorderFocus: '#3B82F6',
    
    // Card colors
    cardBackground: '#FFFFFF',
    cardBorder: '#E5E7EB',
    cardShadow: 'rgba(0, 0, 0, 0.1)',
    
    // Status colors
    statusActive: '#10B981',
    statusInactive: '#6B7280',
    statusPending: '#F59E0B',
  },
  dark: {
    primary: '#0A84FF',
    secondary: '#5E5CE6',
    success: '#30D158',
    warning: '#FF9F0A',
    danger: '#FF453A',
    info: '#64D2FF',
    
    // Text colors
    text: '#FFFFFF',
    textSecondary: '#8E8E93',
    textLight: '#6D6D70',
    
    // Background colors
    background: '#000000',
    backgroundSecondary: '#1C1C1E',
    backgroundTertiary: '#2C2C2E',
    
    // Border colors
    border: '#38383A',
    borderLight: '#48484A',
    
    // Form colors
    inputBackground: '#1C1C1E',
    inputBorder: '#38383A',
    inputBorderFocus: '#0A84FF',
    
    // Card colors
    cardBackground: '#1C1C1E',
    cardBorder: '#38383A',
    cardShadow: 'rgba(0, 0, 0, 0.3)',
    
    // Status colors
    statusActive: '#30D158',
    statusInactive: '#8E8E93',
    statusPending: '#FF9F0A',
  },
};

// Default theme
export const defaultTheme = Colors.light;

// Helper function to get colors based on color scheme
export function getThemeColors(colorScheme: 'light' | 'dark' = 'light') {
  return Colors[colorScheme];
}

// For backward compatibility, export direct access to light theme
export const ThemeColors = Colors.light;