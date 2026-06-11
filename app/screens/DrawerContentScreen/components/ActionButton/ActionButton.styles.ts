import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  actionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    paddingVertical: Spacings.md,
    paddingHorizontal: Spacings.lg,
    borderRadius: Spacings.md,
    gap: Spacings.md,
  },
  actionLabel: {
    fontWeight: '500',
  },
});
