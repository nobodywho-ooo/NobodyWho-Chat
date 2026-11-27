import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

const SHEET_RADIUS = 28;

export default StyleSheet.create({
  surface: {
    ...StyleSheet.absoluteFill,
  },
  floatingSurface: {
    borderRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
  },
  standardSurface: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    borderCurve: 'continuous',
  },
  fill: {
    flex: 1,
  },
  closeButton: {
    position: 'absolute',
    top: Spacings.md,
    right: Spacings.md,
    zIndex: 1,
  },
  bottomFade: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 5,
    borderRadius: 2.5,
    marginTop: Spacings.sm,
  },
});
