import { StyleSheet } from 'react-native';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';

const SIZE = 36;
const GLASS_SIZE = 44; // see BUTTON_SIZE in @react-navigation/elements.

export const iconButtonSize = (glass = false) =>
  glass && isLiquidGlassSupported ? GLASS_SIZE : SIZE;

export default StyleSheet.create({
  button: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glassButton: {
    width: GLASS_SIZE,
    height: GLASS_SIZE,
    borderRadius: GLASS_SIZE / 2,
  },
  glass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: GLASS_SIZE / 2,
  },
});
