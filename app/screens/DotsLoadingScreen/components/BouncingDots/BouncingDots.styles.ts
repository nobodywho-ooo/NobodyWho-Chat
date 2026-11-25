import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const DOT_SIZE = 30;
export const AMPLITUDE = 16;

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: Spacings.md,
    paddingVertical: AMPLITUDE,
  },
});
