import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const styles = StyleSheet.create({
  sheetContainer: {
    paddingTop: Spacings.xl,
    paddingBottom: Spacings.lg,
    paddingHorizontal: Spacings.xl,
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
});
