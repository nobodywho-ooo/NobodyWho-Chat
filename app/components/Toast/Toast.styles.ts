import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    position: 'absolute',
    top: Spacings.md,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  toast: {
    maxWidth: '90%',
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
    borderRadius: Spacings.xl,
    overflow: 'hidden',
    borderWidth: 1,
    paddingVertical: Spacings.sm,
    paddingHorizontal: Spacings.md,
    shadowOffset: { width: 0, height: 2 },
  },
  glassWrapper: {
    maxWidth: '90%',
  },
  glassToast: {
    borderRadius: Spacings.xl,
    paddingVertical: Spacings.sm,
    paddingHorizontal: Spacings.md,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
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
  message: {
    flexShrink: 1,
    paddingRight: Spacings.xs,
  },
});
