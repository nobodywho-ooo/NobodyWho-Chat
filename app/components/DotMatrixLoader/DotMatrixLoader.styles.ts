import { StyleSheet } from 'react-native';

export const DOT_SIZE = 14;
export const DOT_GAP = 8;

export default StyleSheet.create({
  grid: {
    gap: DOT_GAP,
  },
  row: {
    flexDirection: 'row',
    gap: DOT_GAP,
  },
  cell: {
    width: DOT_SIZE,
    height: DOT_SIZE,
  },
  glow: {
    ...StyleSheet.absoluteFill,
    borderRadius: DOT_SIZE / 2,
  },
  dot: {
    ...StyleSheet.absoluteFill,
    borderRadius: DOT_SIZE / 2,
  },
});
