import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    paddingTop: Spacings.xxl,
    paddingBottom: Spacings.xl
  }
});
