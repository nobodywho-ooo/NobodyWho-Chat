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
    borderWidth: 1,
    paddingVertical: Spacings.sm,
    paddingHorizontal: Spacings.md,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.6,
    shadowRadius: 10,
    elevation: 2,
  },
  message: {
    flexShrink: 1,
    paddingRight: Spacings.xs,
  },
});
