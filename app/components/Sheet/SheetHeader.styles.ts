import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    marginBottom: Spacings.lg,
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: 0.6,
  },
});
