import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const styles = StyleSheet.create({
  sheetContainer: {
    paddingTop: Spacings.xxl,
    paddingBottom: Spacings.xl,
    paddingHorizontal: Spacings.xl,
    alignItems: 'center',
    gap: Spacings.md,
  },
  // Where the model filter sheet's header puts its close icon.
  closeIcon: {
    position: 'absolute',
    top: Spacings.xl,
    right: Spacings.xl,
    zIndex: 1,
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
