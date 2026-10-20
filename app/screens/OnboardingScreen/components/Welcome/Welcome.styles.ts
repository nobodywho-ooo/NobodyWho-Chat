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
    ...Layout.content,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingVertical: Spacings.xxl,
    gap: Spacings.xxxl,
  },
  title: {
    fontWeight: '700',
    textAlign: 'center',
  },
  featuresContainer: {
    paddingTop: Spacings.lg,
    gap: Spacings.xl,
  },
  featureContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.lg,
  },
  featureTextContainer: {
    flex: 1,
    gap: Spacings.xxs,
  },
});
