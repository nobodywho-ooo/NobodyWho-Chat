import { StyleSheet } from 'react-native';
import { Spacings } from 'style';

export default StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.xxs,
    borderRadius: 6,
    paddingHorizontal: Spacings.sm,
    paddingVertical: Spacings.xs,
  },
  text: {
    marginLeft: Spacings.xxs,
    fontSize: 12,
  },
});
