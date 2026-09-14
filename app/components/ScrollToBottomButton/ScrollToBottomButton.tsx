import React, { RefObject } from 'react';
import { Pressable, StyleProp, View, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import { BlurView } from 'expo-blur';
import { useTheme } from 'context';
import { useStyled } from 'hooks';

import { PlatformIcon } from '../PlatformIcon/PlatformIcon';

import styles from './ScrollToBottomButton.styles';
import { isIOS } from 'helpers';

const BLUR_INTENSITY = 12;
const BLUR_REDUCTION_FACTOR = 4;
const ICON_SIZE_ANDROID = 24;
const ICON_SIZE_IOS = 18;

interface ScrollToBottomButtonProps {
  visible: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  blurTarget?: RefObject<View | null>;
}

export const ScrollToBottomButton: React.FC<ScrollToBottomButtonProps> = ({
  visible,
  onPress,
  style,
  blurTarget,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();

  if (!visible) {
    return null;
  }

  return (
    <View style={[styles.container, style]} pointerEvents="box-none">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={t('components.scrollToBottomButton.label')}
        hitSlop={8}
        onPress={onPress}
        style={({ pressed }) => [
          styles.button,
          { borderColor: colors.borderSecondary },
          pressed && styles.buttonPressed,
        ]}
      >
        <BlurView
          style={styles.blurFill}
          intensity={BLUR_INTENSITY}
          tint={theme}
          blurMethod="dimezisBlurViewSdk31Plus"
          blurReductionFactor={BLUR_REDUCTION_FACTOR}
          blurTarget={blurTarget}
        />
        <View
          style={[styles.tint, { backgroundColor: colors.surfaceContainer }]}
        />
        <PlatformIcon
          iosIconName="chevron.down"
          androidIconName="keyboard_arrow_down"
          size={isIOS ? ICON_SIZE_IOS : ICON_SIZE_ANDROID}
          color={colors.onSurface}
        />
      </Pressable>
    </View>
  );
};
