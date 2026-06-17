import React from 'react';
import { View, TextInput, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useStyled } from 'hooks';
import { useTheme } from 'context';
import { IconButton, PlatformIcon } from 'components';
import { Theme } from 'types';

import { styles, INPUT_BAR_HEIGHT } from './InputBar.styles';

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

interface InputBarProps {
  value: string;
  isStreaming: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
}

export const InputBar: React.FC<InputBarProps> & { height: number } = ({
  value,
  isStreaming,
  onChangeText,
  onSend,
  onStop,
  onFocus,
  onBlur,
  style,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();

  const extraStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  };

  const mainViewStyle = [
    styles.mainContainer,
    style,
    { backgroundColor: colors.surface },
  ];

  return (
    <View style={mainViewStyle}>
      <LinearGradient
        pointerEvents="none"
        colors={gradientColors[theme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.topGradient}
      />
      <View style={[styles.inputBarInner, extraStyle]}>
        <TextInput
          style={[styles.textInput, { color: colors.onSurface }]}
          placeholder={t('components.inputBar.placeholder')}
          placeholderTextColor="#999"
          value={value}
          onChangeText={onChangeText}
          onFocus={onFocus}
          onBlur={onBlur}
          multiline
        />
        <InputBarAction
          isStreaming={isStreaming}
          value={value}
          onSend={onSend}
          onStop={onStop}
        />
      </View>
    </View>
  );
};

InputBar.height = INPUT_BAR_HEIGHT;

interface InputBarActionProps {
  isStreaming: boolean;
  value: string;
  onSend: () => void;
  onStop: () => void;
}

const InputBarAction: React.FC<InputBarActionProps> = ({
  isStreaming,
  value,
  onSend,
  onStop,
}) => {
  const { colors } = useStyled();

  if (isStreaming) {
    return (
      <Pressable onPress={onStop}>
        <PlatformIcon
          iosIconName="stop.circle"
          androidIconName="stop_circle"
          size={28}
          color={colors.dangerSurface}
        />
      </Pressable>
    );
  }

  let color = colors.ctaContentPrimary;
  let backgroundColor = colors.ctaSurfacePrimary;

  if (value === '') {
    color = colors.ctaContentPrimary;
    backgroundColor = colors.ctaSurfacePrimaryDisabled;
  }

  return (
    <IconButton
      icon={{
        iosIconName: 'arrow.up',
        androidIconName: 'arrow_upward',
      }}
      onPress={onSend}
      size={20}
      color={color}
      backgroundColor={backgroundColor}
    />
  );
};
