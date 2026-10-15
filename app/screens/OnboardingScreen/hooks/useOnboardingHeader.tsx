import React, { useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePreventRemove } from '@react-navigation/native';
import { Text } from 'components';
import { useStyled } from 'hooks';

import {
  OnboardingParamList,
  OnboardingScreenProps,
} from '../Onboarding.types';
import { useOnboarding } from './useOnboarding';

export const useOnboardingHeader = (
  navigation: OnboardingScreenProps<keyof OnboardingParamList>['navigation'],
  isLocked: boolean,
) => {
  const { onFinish } = useOnboarding();
  const { t } = useTranslation();
  const { colors } = useStyled();

  useLayoutEffect(() => {
    const label = t('screens.onboarding.skip');

    navigation.setOptions({
      headerBackVisible: !isLocked,
      gestureEnabled: !isLocked,
      // Android; iOS uses the native item below.
      headerRight: isLocked
        ? undefined
        : () => (
            <Pressable
              onPress={onFinish}
              hitSlop={8}
              accessibilityRole="button"
              testID="onboarding-skip-button"
            >
              <Text variant="body1" bold style={{ color: colors.primary }}>
                {label}
              </Text>
            </Pressable>
          ),
      unstable_headerRightItems: isLocked
        ? undefined
        : () => [
            {
              type: 'button',
              label,
              tintColor: colors.onSurface,
              onPress: onFinish,
            },
          ],
    });
  }, [navigation, isLocked, onFinish, t, colors]);

  usePreventRemove(isLocked, () => undefined);
};
