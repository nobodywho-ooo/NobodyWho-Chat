import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

const SHEET_RADIUS = 28;
const BACKDROP_OPACITY = 0.4;

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
    paddingTop: Spacings.xxl,
    paddingHorizontal: Spacings.xl,
    alignItems: 'center',
    gap: Spacings.md,
  },
  iconContainer: {
    padding: Spacings.md,
    borderRadius: Spacings.xxl,
    marginBottom: Spacings.xs,
  },
  centeredText: {
    textAlign: 'center',
  },
  progressContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
    marginTop: Spacings.md,
  },
  actionsContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
    marginTop: Spacings.md,
  },
});
