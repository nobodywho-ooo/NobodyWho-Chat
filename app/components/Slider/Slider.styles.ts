import { StyleSheet } from 'react-native';

export const THUMB_SIZE = 24;

export default StyleSheet.create({
  container: {
    height: THUMB_SIZE + 16,
    justifyContent: 'center',
  },
  track: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  fill: {
    height: '100%',
    borderRadius: 2,
  },
  thumb: {
    position: 'absolute',
    width: THUMB_SIZE,
    height: THUMB_SIZE,
    borderRadius: THUMB_SIZE / 2,
  },
});
