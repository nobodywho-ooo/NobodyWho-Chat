import React, { useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useNavigation, usePreventRemove } from 'expo-router';
import { Text } from 'components';
import { useStyled } from 'hooks';

import { useOnboarding } from './useOnboarding';

export const useOnboardingHeader = (isLocked: boolean) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { onFinish } = useOnboarding();
  const navigation = useNavigation();

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
