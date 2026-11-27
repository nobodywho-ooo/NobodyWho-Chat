import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  sheetContainer: {
    paddingTop: Spacings.xxl,
    paddingBottom: Spacings.xl,
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
  actionsContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
    marginTop: Spacings.md,
  },
});
