import { StyleSheet } from 'react-native';

import { Spacings } from 'style';

export default StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  title: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
});
