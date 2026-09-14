import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

const SIZE = 36;

export default StyleSheet.create({
  container: {
    alignItems: 'center',
  },
  button: {
    width: SIZE,
    height: SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: SIZE / 2,
    overflow: 'hidden',
    borderWidth: 1,
    shadowOffset: { width: 0, height: 2 },
  },
  buttonPressed: {
    opacity: 0.6,
  },
  blurFill: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  tint: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    opacity: 0.55,
  },
  spacingContainer: {
    marginBottom: Spacings.sm,
  },
});
