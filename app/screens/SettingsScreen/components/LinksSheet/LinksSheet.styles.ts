import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export const LOGO_SLOT_WIDTH = 28;

export default StyleSheet.create({
  container: {
    paddingTop: Spacings.xl,
    paddingBottom: Spacings.lg,
    paddingHorizontal: Spacings.xl,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    paddingVertical: Spacings.md,
  },
  logoSlot: {
    width: LOGO_SLOT_WIDTH,
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    gap: Spacings.xxs,
  },
  pressed: {
    opacity: 0.6,
  },
});
