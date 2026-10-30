import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';

// The hero text keeps to the left so the discs on the right never run under it.
const HERO_MAX_WIDTH = '62%';

export default StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    ...Layout.container,
    paddingHorizontal: ONBOARDING_PADDING_HORIZONTAL,
  },
  heroContainer: {
    flex: 1,
    justifyContent: 'center',
    paddingVertical: Spacings.xxl,
  },
  title: {
    maxWidth: HERO_MAX_WIDTH,
  },
});
