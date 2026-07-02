import { StyleSheet } from 'react-native';

import { Layout, Spacings } from 'style';

export default StyleSheet.create({
  container: {
    ...Layout.container,
    paddingTop: Spacings.lg,
  },
  sectionHeader: {
    paddingTop: Spacings.xl,
  },
  sliderRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.md,
    paddingTop: Spacings.xs,
  },
  sliderContainer: {
    flex: 1,
  },
  sliderValue: {
    minWidth: 32,
    textAlign: 'right',
  },
  systemPromptInput: {
    marginTop: Spacings.sm,
    minHeight: 96,
    borderWidth: 1,
    borderRadius: 12,
    padding: Spacings.md,
    textAlignVertical: 'top',
  },
  switchRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacings.md,
    marginTop: Spacings.xl,
  },
  switchContainer: {
    justifyContent: 'center'
  },
  tokenRowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacings.md,
    paddingTop: Spacings.xl,
  },
  switchLabel: {
    flex: 1,
  },
  tokenLabel: {
    flex: 1,
  },
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  stepperValue: {
    minWidth: 48,
    textAlign: 'center',
  },
});
