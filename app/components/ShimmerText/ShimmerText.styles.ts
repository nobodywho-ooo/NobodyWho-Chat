import { StyleSheet } from 'react-native';

export default StyleSheet.create({
  container: {
    // Lets a long single line ellipsize instead of overflowing its row.
    flexShrink: 1,
  },
  text: {
    fontWeight: '600',
  },
  veilContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  stripContainer: {
    position: 'absolute',
    top: 0,
    bottom: 0,
    left: 0,
  },
  gradientContainer: {
    flex: 1,
  },
});
