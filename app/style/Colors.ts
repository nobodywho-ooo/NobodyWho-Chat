import { Theme } from '../types/Theme.types';

export type NWColors = {
  ctaContentPrimary: string;
  ctaSurfacePrimary: string;
  ctaSurfacePrimaryDisabled: string;
  ctaContentSecondary: string;
  ctaSurfaceSecondary: string;
  ctaContentOutline: string;
  ctaSurfaceOutline: string;
  ctaBorderOutline: string;
  surface: string;
  surfaceSecondary: string;
  onSurface: string;
  onSurfaceVariant: string;
  onSurfaceDisabled: string;
  surfaceContainer: string;
  primary: string;
  dangerSurface: string;
  dangerContent: string;
  successSurface: string;
  successContent: string;
  border: string;
  shadow: string;
  tabBarActive: string;
  tabBarInactive: string;
};

export const lightColors: NWColors = {
  ctaContentPrimary: '#FFFFFF',
  ctaSurfacePrimary: '#628395',
  ctaSurfacePrimaryDisabled: '#b0c1cb',
  ctaContentSecondary: '#FFFFFF',
  ctaSurfaceSecondary: '#000000',
  ctaContentOutline: '#000000',
  ctaSurfaceOutline: 'transparent',
  ctaBorderOutline: '#9f9f9f',
  surface: '#FFFFFF',
  surfaceSecondary: '#f7f7f7',
  onSurface: '#000000',
  onSurfaceVariant: '#7c7c7c',
  onSurfaceDisabled: '#c1c1c1',
  surfaceContainer: '#ebebeb',
  primary: '#628395',
  dangerSurface: '#f9342a',
  dangerContent: '#FFFFFF',
  successSurface: '#2ec728',
  successContent: '#FFFFFF',
  border: '#e1e1e1',
  shadow: 'rgba(44, 44, 44, 0.24)',
  tabBarActive: '#628395',
  tabBarInactive: '#828282',
};

export const darkColors: NWColors = {
  ctaContentPrimary: '#FFFFFF',
  ctaSurfacePrimary: '#628395',
  ctaSurfacePrimaryDisabled: '#151e24',
  ctaContentSecondary: '#000000',
  ctaSurfaceSecondary: '#FFFFFF',
  ctaContentOutline: '#FFFFFF',
  ctaSurfaceOutline: 'transparent',
  ctaBorderOutline: '#cacaca',
  surface: '#121212',
  surfaceSecondary: '#2d2d2d',
  onSurface: '#FFFFFF',
  onSurfaceVariant: '#d8d8d8',
  onSurfaceDisabled: '#8d8d8d',
  surfaceContainer: '#3c3c3c',
  primary: '#628395',
  dangerSurface: '#f9342a',
  dangerContent: '#FFFFFF',
  successSurface: '#2ec728',
  successContent: '#FFFFFF',
  border: '#404040',
  shadow: 'rgba(244, 244, 244, 0.48)',
  tabBarActive: '#628395',
  tabBarInactive: '#9e9e9e',
};

export const getColors = (theme: Theme): NWColors => {
  return theme === 'light' ? lightColors : darkColors;
};
