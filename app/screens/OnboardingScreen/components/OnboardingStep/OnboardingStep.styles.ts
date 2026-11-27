import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingHorizontal: ONBOARDING_PADDING_HORIZONTAL,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  content: {
    ...Layout.content,
    flexGrow: 1,
  },
  headerContainer: {
    flexGrow: 1,
    flexShrink: 0,
    justifyContent: 'center',
    paddingVertical: Spacings.xxl,
  },
  header: {
    fontWeight: '700',
    textAlign: 'center',
  },
  subtitle: {
    paddingTop: Spacings.sm,
    paddingBottom: Spacings.xxl,
  },
});
