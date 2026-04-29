import { Theme } from '../types/Theme.types';

export const lightColors = {
  surface: '#FFFFFF',
  surfaceSecondary: '#FFFFFF',
  onSurface: '#000000',
  onSurfaceVariant: '#7c7c7c',
  surfaceContainer: '#ebebeb',
  primary: '#628395',
  danger: '#f9342a',
  disable: '#c1c1c1',
  border: '#9f9f9f',
  shadow: 'rgba(44, 44, 44, 0.24)',
  tabBarActive: '#628395',
  tabBarInactive: '#828282',
};

export const darkColors = {
  surface: '#121212',
  surfaceSecondary: '#2d2d2d',
  onSurface: '#FFFFFF',
  surfaceContainer: '#3c3c3c',
  primary: '#628395',
  danger: '#F32013',
  disable: '#c7c7c7',
  border: '#cacaca',
  onSurfaceVariant: '#d8d8d8',
  shadow: 'rgba(244, 244, 244, 0.48)',
  tabBarActive: '#628395',
  tabBarInactive: '#9e9e9e',
};

export const getColors = (theme: Theme) => {
  return theme === 'light' ? lightColors : darkColors;
};
