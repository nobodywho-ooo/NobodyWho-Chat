import React, { useEffect, useRef } from 'react';
import { View, TextInput, StyleProp, ViewStyle } from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import { useStyled } from 'hooks';
import { useTheme } from 'context';
import { IconButton, IconButtonIconProps, Text } from 'components';
import { Theme } from 'types';

import { styles, INPUT_BAR_HEIGHT } from './InputBar.styles';
import { haptics } from 'helpers';

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

export type ImageAttachSource = 'photo' | 'camera';

interface InputBarProps {
  value: string;
  isStreaming: boolean;
  attachExpanded: boolean;
  onAttachExpandedChange: (expanded: boolean) => void;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  style?: StyleProp<ViewStyle>;
  topAccessory?: React.ReactNode;
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
  attachExpanded,
  onAttachExpandedChange,
  onChangeText,
  onSend,
  onStop,
  onFocus,
  onBlur,
  style,
  topAccessory,
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

  const canAttach = showImageAttach || showAudioAttach;
  const showToggle = canAttach && !isStreaming;
  const expanded = showToggle && attachExpanded;
  const hasImage = imageSource !== undefined;
  const hasAttachment = hasImage || hasAudio;

  const showPhoto =
    showImageAttach && (hasAttachment ? imageSource === 'photo' : true);
  const showCamera =
    showImageAttach && (hasAttachment ? imageSource === 'camera' : true);
  const showAudio = showAudioAttach && (hasAttachment ? hasAudio : true);

  const prevAttachments = useRef({ hasImage, hasAudio });

  useEffect(() => {
    const addedImage = hasImage && !prevAttachments.current.hasImage;
    const addedAudio = hasAudio && !prevAttachments.current.hasAudio;
    if (addedImage || addedAudio) {
      onAttachExpandedChange(false);
    }
    prevAttachments.current = { hasImage, hasAudio };
  }, [hasImage, hasAudio, onAttachExpandedChange]);

  useEffect(() => {
    if (attachExpanded && !showToggle) {
      onAttachExpandedChange(false);
    }
  }, [attachExpanded, showToggle, onAttachExpandedChange]);

  const toggleAttach = () => {
    haptics.medium();
    onAttachExpandedChange(!attachExpanded);
  };

  const handleSend = () => {
    if (attachExpanded) {
      onAttachExpandedChange(false);
    }
    onSend();
  };

  const extraStyle = {
    backgroundColor: colors.surface,
    borderColor: colors.border,
    borderWidth: 1,
  };

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
    <View style={styles.mainContainer}>
      {topAccessory}
      {expanded && (
        <View style={[styles.attachOptionsList, extraStyle]}>
          {showPhoto &&
            renderAttachOption({
              icon: { iosIconName: 'photo', androidIconName: 'image' },
              label:
                imageSource === 'photo'
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
              label:
                imageSource === 'camera'
                  ? t('components.inputBar.unselect')
                  : t('components.inputBar.camera'),
              active: imageSource === 'camera',
              onPress: onAttachCamera,
              accessibilityLabel: t('components.inputBar.attachCamera'),
            })}
          {showAudio &&
            renderAttachOption({
              icon: {
                iosIconName: 'waveform',
                androidIconName: 'music_note',
              },
              label: hasAudio
                ? t('components.inputBar.unselect')
                : t('components.inputBar.audio'),
              active: hasAudio,
              onPress: onAttachAudio,
              accessibilityLabel: t('components.inputBar.attachAudio'),
            })}
        </View>
      )}
      <View
        style={[
          styles.inputFieldContainer,
          style,
          { backgroundColor: colors.surface },
        ]}
      >
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
                    ? {
                        iosIconName: 'paperclip',
                        androidIconName: 'attach_file',
                      }
                    : { iosIconName: 'plus', androidIconName: 'add' },
                active: !expanded && hasAttachment,
                onPress: toggleAttach,
                accessibilityLabel: t(
                  expanded
                    ? 'components.inputBar.closeAttach'
                    : 'components.inputBar.attach',
                ),
              })}
          </View>
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
            onSend={handleSend}
            onStop={onStop}
          />
        </View>
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
    color = colors.onSurface;
    backgroundColor = colors.surfaceContainer;
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
