import React, { useEffect, useRef, useState } from 'react';
import { View, TextInput, Pressable, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useStyled } from 'hooks';
import { useTheme } from 'context';
import { IconButton, PlatformIcon, Text } from 'components';
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

  // Collapse the tray as soon as an attachment is added (in either modality),
  // dropping the user straight back to the text field. Tracking the previous
  // values means adding a second modality still collapses, while deselecting
  // leaves the tray open so another can be picked.
  const prevAttachments = useRef({ hasImage, hasAudio });
  useEffect(() => {
    const addedImage = hasImage && !prevAttachments.current.hasImage;
    const addedAudio = hasAudio && !prevAttachments.current.hasAudio;
    if (addedImage || addedAudio) {
      setAttachExpanded(false);
    }
    prevAttachments.current = { hasImage, hasAudio };
  }, [hasImage, hasAudio]);

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

  const renderAttachButton = (
    icon: React.ComponentProps<typeof IconButton>['icon'],
    active: boolean,
    onPress: (() => void) | undefined,
    accessibilityLabel: string,
  ) => (
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

  const renderAttachOption = (
    icon: React.ComponentProps<typeof IconButton>['icon'],
    label: string,
    active: boolean,
    onPress: (() => void) | undefined,
    accessibilityLabel: string,
  ) => (
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
      <View style={[styles.inputBarInner, extraStyle]}>
        {showToggle &&
          renderAttachButton(
            expanded
              ? { iosIconName: 'xmark', androidIconName: 'close' }
              : hasAttachment
                ? { iosIconName: 'paperclip', androidIconName: 'attach_file' }
                : { iosIconName: 'plus', androidIconName: 'add' },
            !expanded && hasAttachment,
            () => setAttachExpanded(prev => !prev),
            t(
              expanded
                ? 'components.inputBar.closeAttach'
                : 'components.inputBar.attach',
            ),
          )}
        {expanded ? (
          <View style={styles.attachOptions}>
            {showPhoto &&
              renderAttachOption(
                { iosIconName: 'photo', androidIconName: 'image' },
                t('components.inputBar.photo'),
                imageSource === 'photo',
                onAttachImage,
                t('components.inputBar.attachImage'),
              )}
            {showCamera &&
              renderAttachOption(
                { iosIconName: 'camera', androidIconName: 'photo_camera' },
                t('components.inputBar.camera'),
                imageSource === 'camera',
                onAttachCamera,
                t('components.inputBar.attachCamera'),
              )}
            {showAudioAttach &&
              renderAttachOption(
                { iosIconName: 'waveform', androidIconName: 'music_note' },
                t('components.inputBar.audio'),
                hasAudio,
                onAttachAudio,
                t('components.inputBar.attachAudio'),
              )}
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
