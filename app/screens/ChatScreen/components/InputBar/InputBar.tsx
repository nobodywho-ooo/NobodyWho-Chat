import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, StyleProp, ViewStyle, Keyboard } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useStyled } from 'hooks';
import { useTheme } from 'context';
import { IconButton, IconButtonIconProps, Text } from 'components';
import { Theme } from 'types';

import { styles, INPUT_BAR_HEIGHT } from './InputBar.styles';

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export type ImageAttachSource = 'photo' | 'camera';

interface InputBarProps {
  value: string;
  isStreaming: boolean;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  showImageAttach?: boolean;
  showAudioAttach?: boolean;
  imageSource?: ImageAttachSource;
  hasAudio?: boolean;
  onAttachImage?: () => void;
  onAttachCamera?: () => void;
  onAttachAudio?: () => void;
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
  showImageAttach = false,
  showAudioAttach = false,
  imageSource,
  hasAudio = false,
  onAttachImage,
  onAttachCamera,
  onAttachAudio,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();
  const [attachExpanded, setAttachExpanded] = useState(false);

  const canAttach = showImageAttach || showAudioAttach;
  const showToggle = canAttach && !isStreaming;
  const expanded = showToggle && attachExpanded;
  const hasImage = imageSource !== undefined;
  const hasAttachment = hasImage || hasAudio;
  const showPhoto = showImageAttach && imageSource !== 'camera';
  const showCamera = showImageAttach && imageSource !== 'photo';

  const prevAttachments = useRef({ hasImage, hasAudio });

  useEffect(() => {
    const addedImage = hasImage && !prevAttachments.current.hasImage;
    const addedAudio = hasAudio && !prevAttachments.current.hasAudio;
    if (addedImage || addedAudio) {
      setAttachExpanded(false);
    }
    prevAttachments.current = { hasImage, hasAudio };
  }, [hasImage, hasAudio]);

  const toggleAttach = () => {
    // Dismiss the keyboard as we open the tray, while the TextInput is still
    // mounted to receive the blur. If we waited until after the re-render (the
    // tray replaces the TextInput), there'd be no focused input left to blur,
    // and on Android the orphaned soft keyboard lingers and reconfigures — a
    // number row appears, growing it past the height ChatScreen measured, so it
    // covers the input bar. There's nothing to type into while the tray is open.
    if (!attachExpanded) {
      Keyboard.dismiss();
    }
    setAttachExpanded(prev => !prev);
  };

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

  const renderAttachButton = ({
    icon,
    active,
    onPress,
    accessibilityLabel,
  }: {
    icon: React.ComponentProps<typeof IconButton>['icon'];
    active: boolean;
    onPress: (() => void) | undefined;
    accessibilityLabel: string;
  }) => (
    <View style={styles.attachContainer}>
      <IconButton
        icon={icon}
        onPress={onPress}
        size={20}
        color={active ? colors.ctaContentPrimary : colors.onSurface}
        backgroundColor={
          active ? colors.ctaSurfacePrimary : colors.surfaceContainer
        }
        accessibilityLabel={accessibilityLabel}
      />
    </View>
  );

  const renderAttachOption = ({
    icon,
    label,
    active,
    onPress,
    accessibilityLabel,
  }: {
    icon: React.ComponentProps<typeof IconButton>['icon'];
    label: string;
    active: boolean;
    onPress: (() => void) | undefined;
    accessibilityLabel: string;
  }) => (
    <View style={styles.attachOption}>
      <IconButton
        icon={icon}
        onPress={onPress}
        size={20}
        color={active ? colors.ctaContentPrimary : colors.onSurface}
        backgroundColor={
          active ? colors.ctaSurfacePrimary : colors.surfaceContainer
        }
        accessibilityLabel={accessibilityLabel}
      />
      <Text
        variant="body2"
        style={[styles.attachLabel, { color: colors.onSurface }]}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <View style={mainViewStyle}>
      <LinearGradient
        pointerEvents="none"
        colors={gradientColors[theme]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={styles.topGradient}
      />
      <View style={[styles.inputBarContainer, extraStyle]}>
        <View style={styles.attachMainContainer}>
          {showToggle &&
            renderAttachButton({
              icon: expanded
                ? { iosIconName: 'xmark', androidIconName: 'close' }
                : hasAttachment
                  ? { iosIconName: 'paperclip', androidIconName: 'attach_file' }
                  : { iosIconName: 'plus', androidIconName: 'add' },
              active: !expanded && hasAttachment,
              onPress: toggleAttach,
              accessibilityLabel: t(
                expanded
                  ? 'components.inputBar.closeAttach'
                  : 'components.inputBar.attach',
              ),
            })}
          {expanded && (
            <Text
              variant="body2"
              style={[styles.closeLabel, { color: colors.onSurface }]}
            >
              {t('components.inputBar.close')}
            </Text>
          )}
        </View>
        {expanded ? (
          <View style={styles.attachOptions}>
            {showPhoto &&
              renderAttachOption({
                icon: { iosIconName: 'photo', androidIconName: 'image' },
                label: hasAttachment
                  ? t('components.inputBar.unselect')
                  : t('components.inputBar.photo'),
                active: imageSource === 'photo',
                onPress: onAttachImage,
                accessibilityLabel: t('components.inputBar.attachImage'),
              })}
            {showCamera &&
              renderAttachOption({
                icon: {
                  iosIconName: 'camera',
                  androidIconName: 'photo_camera',
                },
                label: hasAttachment
                  ? t('components.inputBar.unselect')
                  : t('components.inputBar.camera'),
                active: imageSource === 'camera',
                onPress: onAttachCamera,
                accessibilityLabel: t('components.inputBar.attachCamera'),
              })}
            {showAudioAttach &&
              renderAttachOption({
                icon: {
                  iosIconName: 'waveform',
                  androidIconName: 'music_note',
                },
                label: hasAttachment
                  ? t('components.inputBar.unselect')
                  : t('components.inputBar.audio'),
                active: hasAudio,
                onPress: onAttachAudio,
                accessibilityLabel: t('components.inputBar.attachAudio'),
              })}
          </View>
        ) : (
          <>
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
          </>
        )}
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

  let color = colors.ctaContentPrimary;
  let backgroundColor = colors.ctaSurfacePrimary;
  let icon: IconButtonIconProps = {
    iosIconName: 'arrow.up',
    androidIconName: 'arrow_upward',
  };

  if (value === '') {
    color = colors.ctaContentPrimary;
    backgroundColor = colors.ctaSurfacePrimaryDisabled;
  }

  if (isStreaming) {
    color = colors.ctaContentSecondary;
    backgroundColor = colors.ctaSurfaceSecondary;
    icon = {
      iosIconName: 'stop',
      androidIconName: 'stop',
    };
  }

  return (
    <IconButton
      icon={icon}
      onPress={isStreaming ? onStop : onSend}
      size={20}
      color={color}
      backgroundColor={backgroundColor}
    />
  );
};
