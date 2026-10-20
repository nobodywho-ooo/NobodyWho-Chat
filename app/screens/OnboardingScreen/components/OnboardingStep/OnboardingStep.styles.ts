import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingHorizontal: ONBOARDING_PADDING_HORIZONTAL,
  },
  content: {
    ...Layout.content,
    flex: 1,
  },
  // Takes the free space above the step, pushing it to the bottom edge.
  headerContainer: {
    flex: 1,
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
