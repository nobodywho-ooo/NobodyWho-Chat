import { StyleSheet } from 'react-native';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';

const SIZE = 36;
const GLASS_SIZE = 44; // see BUTTON_SIZE in @react-navigation/elements.

export const iconButtonSize = (compact = false) =>
  isLiquidGlassSupported && !compact ? GLASS_SIZE : SIZE;

export default StyleSheet.create({
  button: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  glass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
  },
});
