import React, { useLayoutEffect } from 'react';
import { Pressable } from 'react-native';
import { useTranslation } from 'react-i18next';
import { usePreventRemove } from '@react-navigation/native';
import { PlatformIcon, Text } from 'components';
import { isIOS } from 'helpers';
import { useStyled } from 'hooks';

import {
  OnboardingParamList,
  OnboardingScreenProps,
} from '../Onboarding.types';
import { useOnboarding } from './useOnboarding';

const BACK_ICON_SIZE = 20;

export const useOnboardingHeader = (
  navigation: OnboardingScreenProps<keyof OnboardingParamList>['navigation'],
  isLocked: boolean,
) => {
  const { onFinish } = useOnboarding();
  const { t } = useTranslation();
  const { colors } = useStyled();

  useLayoutEffect(() => {
    const label = t('screens.onboarding.skip');
    const showBack = !isLocked && navigation.canGoBack();

    navigation.setOptions({
      // iOS gets its own back button below: in landscape (a foldable's inner
      // display) UIKit draws the system one under the status bar, outside the
      // header.
      headerBackVisible: !isIOS && !isLocked,
      gestureEnabled: !isLocked,
      // A React element, not unstable_headerLeftItems: UIKit misplaces native
      // leading bar items exactly like the system back button.
      headerLeft:
        isIOS && showBack
          ? () => (
              <Pressable
                onPress={navigation.goBack}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('screens.onboarding.back')}
                testID="onboarding-back-button"
              >
                <PlatformIcon
                  iosIconName="chevron.left"
                  androidIconName="arrow_back"
                  size={BACK_ICON_SIZE}
                  color={colors.onSurface}
                />
              </Pressable>
            )
          : undefined,
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
