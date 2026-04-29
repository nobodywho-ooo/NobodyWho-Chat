import { Theme } from '../types/Theme.types';

export type NWColors = {
  surface: string;
  surfaceSecondary: string;
  onSurface: string;
  onSurfaceVariant: string;
  onSurfaceDisabled: string;
  surfaceContainer: string;
  primary: string;
  danger: string;
  border: string;
  shadow: string;
  tabBarActive: string;
  tabBarInactive: string;
};

export const lightColors: NWColors = {
  surface: '#FFFFFF',
  surfaceSecondary: '#FFFFFF',
  onSurface: '#000000',
  onSurfaceVariant: '#7c7c7c',
  onSurfaceDisabled: '#c1c1c1',
  surfaceContainer: '#ebebeb',
  primary: '#628395',
  danger: '#f9342a',
  border: '#9f9f9f',
  shadow: 'rgba(44, 44, 44, 0.24)',
  tabBarActive: '#628395',
  tabBarInactive: '#828282',
};

export const darkColors: NWColors = {
  surface: '#121212',
  surfaceSecondary: '#2d2d2d',
  onSurface: '#FFFFFF',
  onSurfaceVariant: '#d8d8d8',
  onSurfaceDisabled: '#8d8d8d',
  surfaceContainer: '#3c3c3c',
  primary: '#628395',
  danger: '#F32013',
  border: '#cacaca',
  shadow: 'rgba(244, 244, 244, 0.48)',
  tabBarActive: '#628395',
  tabBarInactive: '#9e9e9e',
};

export const getColors = (theme: Theme): NWColors => {
  return theme === 'light' ? lightColors : darkColors;
};
