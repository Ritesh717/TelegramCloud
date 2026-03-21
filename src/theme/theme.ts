import { Theme } from '@react-navigation/native';

export const THEME = {
  colors: {
    background: '#F6F8FC',
    backgroundAccent: '#EAF1FB',
    surface: '#FFFFFF',
    surfaceSecondary: '#F1F3F4',
    surfaceTertiary: '#E8F0FE',
    card: '#FFFFFF',
    primary: '#1A73E8',
    primaryStrong: '#185ABC',
    primaryLight: '#D3E3FD',
    accent: '#34A853',
    accentLight: '#D7F8E3',
    text: '#202124',
    textSecondary: '#5F6368',
    textMuted: '#80868B',
    border: '#DADCE0',
    borderSoft: '#E8EAED',
    success: '#188038',
    successLight: '#D7F8E3',
    error: '#D93025',
    errorLight: '#FCE8E6',
    warning: '#F9AB00',
    overlay: 'rgba(32, 33, 36, 0.34)',
    scrim: 'rgba(32, 33, 36, 0.62)',
    white: '#FFFFFF',
    selectedBackground: '#F7FAFF',
    surfaceOverlay: 'rgba(246,248,252,0.96)',
    toggleTrackOn: '#A8C7FA',
  },
  spacing: {
    xs: 4,
    sm: 8,
    md: 16,
    lg: 24,
    xl: 32,
    xxl: 40,
  },
  borderRadius: {
    xs: 8,
    sm: 12,
    md: 18,
    lg: 24,
    xl: 32,
    full: 9999,
  },
  typography: {
    display: {
      fontSize: 32,
      lineHeight: 38,
      fontWeight: '700' as const,
      letterSpacing: -0.7,
    },
    title: {
      fontSize: 24,
      lineHeight: 30,
      fontWeight: '700' as const,
      letterSpacing: -0.4,
    },
    titleSmall: {
      fontSize: 18,
      lineHeight: 24,
      fontWeight: '600' as const,
    },
    body: {
      fontSize: 15,
      lineHeight: 22,
      fontWeight: '400' as const,
    },
    bodyMedium: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '500' as const,
    },
    label: {
      fontSize: 12,
      lineHeight: 16,
      fontWeight: '600' as const,
      letterSpacing: 0.2,
    },
  },
  motion: {
    fast: 160,
    normal: 240,
    slow: 360,
  },
  shadow: {
    soft: {
      shadowColor: '#202124',
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.08,
      shadowRadius: 24,
      elevation: 6,
    },
    card: {
      shadowColor: '#202124',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.06,
      shadowRadius: 18,
      elevation: 4,
    },
  },
};

export const NAV_THEME: Theme = {
  dark: false,
  colors: {
    primary: THEME.colors.primary,
    background: THEME.colors.background,
    card: THEME.colors.surface,
    text: THEME.colors.text,
    border: THEME.colors.borderSoft,
    notification: THEME.colors.error,
  },
  fonts: {
    regular: {
      fontFamily: 'System',
      fontWeight: '400',
    },
    medium: {
      fontFamily: 'System',
      fontWeight: '500',
    },
    bold: {
      fontFamily: 'System',
      fontWeight: '700',
    },
    heavy: {
      fontFamily: 'System',
      fontWeight: '800',
    },
  },
};
