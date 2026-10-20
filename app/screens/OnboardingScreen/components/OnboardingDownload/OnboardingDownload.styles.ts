import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

import { ONBOARDING_PADDING_HORIZONTAL } from '../../Onboarding.styles';

export default StyleSheet.create({
  progressContainer: {
    gap: Spacings.sm,
  },
  progressLabel: {
    textAlign: 'center',
  },
  cancelButton: {
    marginTop: Spacings.xxl,
  },
  doneContainer: {
    ...Layout.container,
    paddingHorizontal: ONBOARDING_PADDING_HORIZONTAL,
  },
  doneColumn: {
    ...Layout.content,
    flex: 1,
  },
  doneContent: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacings.md,
  },
  doneTitle: {
    fontWeight: '700',
    textAlign: 'center',
    marginTop: Spacings.md,
  },
  doneSubtitle: {
    textAlign: 'center',
  },
});
