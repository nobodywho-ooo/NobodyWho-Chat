import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

const SHEET_RADIUS = 28;
const BACKDROP_OPACITY = 0.4;
const DOT_SIZE = 6;

export const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `rgba(0, 0, 0, ${BACKDROP_OPACITY})`,
  },
  sheetContainer: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: Spacings.xl,
    paddingHorizontal: Spacings.xl,
  },
  title: {
    textAlign: 'center',
    marginBottom: Spacings.xl,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    paddingVertical: Spacings.md,
  },
  pressed: {
    opacity: 0.6,
  },
  selectedDot: {
    width: DOT_SIZE,
    height: DOT_SIZE,
    borderRadius: DOT_SIZE / 2,
  },
});
