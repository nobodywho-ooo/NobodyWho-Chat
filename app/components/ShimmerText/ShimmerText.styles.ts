import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    flexShrink: 1, // ellipsize instead of overflowing its row.
  },
  text: {
    fontWeight: '600',
  },
  maskContainer: {
    flexShrink: 1,
  },
  sizerText: {
    opacity: 0,
  },
  fillContainer: {
    ...StyleSheet.absoluteFill,
  },
  bandContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
});
