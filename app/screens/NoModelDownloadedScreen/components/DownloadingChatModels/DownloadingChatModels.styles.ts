import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
    justifyContent: 'center',
    alignItems: 'center',
  },
  title: {
    paddingTop: Spacings.xxl,
    paddingBottom: Spacings.lg,
    textAlign: 'center',
  },
  modelsContainer: {
    alignSelf: 'stretch',
    gap: Spacings.xl,
  },
  modelContainer: {
    alignItems: 'center',
    gap: Spacings.sm,
  },
  hint: {
    textAlign: 'center',
    paddingTop: Spacings.lg,
    paddingBottom: Spacings.xl,
  },
});
