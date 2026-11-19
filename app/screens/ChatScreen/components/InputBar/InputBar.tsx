import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Keyboard,
  View,
  type LayoutChangeEvent,
  TextInput,
  StyleProp,
  ViewStyle,
  Pressable,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import LinearGradient from 'react-native-linear-gradient';
import {
  LiquidGlassView,
  isLiquidGlassSupported,
} from '@callstack/liquid-glass';
import { useStyled } from 'hooks';
import { useTheme } from 'context';
import { IconButton, IconButtonIconProps, Text } from 'components';
import { useDrawerCoordination } from 'navigation';
import { haptics, isIOS } from 'helpers';
import { Theme } from 'types';

import { styles } from './InputBar.styles';

const KEYBOARD_HIDE_TIMEOUT = 400;

const gradientColors: Record<Theme, string[]> = {
  light: ['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0.9)'],
  dark: ['rgba(18, 18, 18, 0)', 'rgba(18, 18, 18, 0.9)'],
};

const BOTTOM_FADE_LOCATIONS = [0, 0.25, 0.5, 0.75, 1];
const BOTTOM_FADE_ALPHAS = [0, 0.156, 0.5, 0.844, 1];
const bottomFadeColors: Record<Theme, string[]> = {
  light: BOTTOM_FADE_ALPHAS.map(alpha => `rgba(255, 255, 255, ${alpha})`),
  dark: BOTTOM_FADE_ALPHAS.map(alpha => `rgba(18, 18, 18, ${alpha})`),
};

export type ImageAttachSource = 'photo' | 'camera';

interface InputBarProps {
  value: string;
  isStreaming: boolean;
  disabled?: boolean;
  attachExpanded: boolean;
  onAttachExpandedChange: (expanded: boolean) => void;
  onChangeText: (text: string) => void;
  onSend: () => void;
  onStop: () => void;
  onFocus?: () => void;
  onBlur?: () => void;
  composerRef?: React.Ref<React.ComponentRef<typeof View>>;
  onComposerLayout?: (event: LayoutChangeEvent) => void;
  style?: StyleProp<ViewStyle>;
  messageStarters?: React.ReactNode;
  showImageAttach?: boolean;
  showAudioAttach?: boolean;
  imageSource?: ImageAttachSource;
  hasAudio?: boolean;
  onAttachImage?: () => void;
  onAttachCamera?: () => void;
  onAttachAudio?: () => void;
  showDictation?: boolean;
  isRecording?: boolean;
  isTranscribing?: boolean;
  onStartDictation?: () => void;
  onStopDictation?: () => void;
  showWebSearch?: boolean;
  webSearchEnabled?: boolean;
  onToggleWebSearch?: () => void;
}

const InputBarView: React.FC<InputBarProps> = ({
  value,
  isStreaming,
  disabled = false,
  attachExpanded,
  onAttachExpandedChange,
  onChangeText,
  onSend,
  onStop,
  onFocus,
  onBlur,
  composerRef,
  onComposerLayout,
  style,
  messageStarters,
  showImageAttach = false,
  showAudioAttach = false,
  imageSource,
  hasAudio = false,
  onAttachImage,
  onAttachCamera,
  onAttachAudio,
  showDictation = false,
  isRecording = false,
  isTranscribing = false,
  onStartDictation,
  onStopDictation,
  showWebSearch = false,
  webSearchEnabled = false,
  onToggleWebSearch,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const theme = useTheme();
  const { open: openDrawer, reportSwipeExclusion } = useDrawerCoordination();

  const [focused, setFocused] = useState(false);

  // iOS doesn't grow a multiline TextInput to fit a value set from outside
  const [syncedValue, setSyncedValue] = useState(value);
  const [inputKey, setInputKey] = useState(0);
  if (value !== syncedValue) {
    setSyncedValue(value);
    if (isIOS && value !== '') {
      setInputKey(key => key + 1);
    }
  }

  const handleChangeText = useCallback(
    (text: string) => {
      setSyncedValue(text);
      onChangeText(text);
    },
    [onChangeText],
  );

  const canAttach = showImageAttach || showAudioAttach;
  const showAttachButton = canAttach;
  const expanded = showAttachButton && attachExpanded;
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
    if (attachExpanded && !showAttachButton) {
      onAttachExpandedChange(false);
    }
  }, [attachExpanded, showAttachButton, onAttachExpandedChange]);

  const toggleAttach = () => {
    haptics.medium();
    onAttachExpandedChange(!attachExpanded);
  };

  // Undoes the wait below (drops the listener and the timeout) — set only while
  // an open is pending on the keyboard, so it doubles as "is one pending".
  const cancelPendingOpen = useRef<(() => void) | undefined>(undefined);

  const openVoiceAssistant = () => {
    if (!Keyboard.isVisible()) {
      openDrawer('right');
      return;
    }

    cancelPendingOpen.current?.();

    const open = () => {
      cancelPendingOpen.current?.();
      openDrawer('right');
    };

    const subscription = Keyboard.addListener('keyboardDidHide', open);
    const timeout = setTimeout(open, KEYBOARD_HIDE_TIMEOUT);

    cancelPendingOpen.current = () => {
      cancelPendingOpen.current = undefined;
      subscription.remove();
      clearTimeout(timeout);
    };

    Keyboard.dismiss();
  };

  useEffect(() => () => cancelPendingOpen.current?.(), []);

  // This container holds everything the bar can grow to — the message starters,
  // the attach options, the field itself — and it's pinned to the bottom of the
  // screen (the keyboard inset arrives as its padding), so its height is exactly
  // the strip the drawer swipes have to ignore. See DrawerCoordination.
  const handleLayout = useCallback(
    ({ nativeEvent }: LayoutChangeEvent) =>
      reportSwipeExclusion(nativeEvent.layout.height),
    [reportSwipeExclusion],
  );

  useEffect(() => () => reportSwipeExclusion(0), [reportSwipeExclusion]);

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

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

  const inputBarStyle = {
    ...extraStyle,
    borderColor: focused ? colors.borderFocused : colors.border,
  };

  const Card = isLiquidGlassSupported ? GlassCard : View;

  const attachButtonIcon: IconButtonIconProps = expanded
    ? { iosIconName: 'xmark', androidIconName: 'close' }
    : hasAttachment
      ? {
          iosIconName: 'paperclip',
          androidIconName: 'attach_file',
        }
      : { iosIconName: 'plus', androidIconName: 'add' };
  const transcribingIconButton: IconButtonIconProps = isRecording
    ? {
        iosIconName: 'stop.fill',
        androidIconName: 'stop',
      }
    : { iosIconName: 'mic', androidIconName: 'mic' };
  const voiceAssistantIconButton: IconButtonIconProps = {
    iosIconName: 'waveform',
    androidIconName: 'graphic_eq',
  };

  const attachButtonAccessibilityLabel = t(
    expanded ? 'components.inputBar.closeAttach' : 'components.inputBar.attach',
  );
  const transcribingIconAccessibilityLabel = t(
    isRecording
      ? 'components.inputBar.stopDictation'
      : 'components.inputBar.dictate',
  );
  const transcribingIconColor = isRecording
    ? colors.dangerContent
    : colors.onSurface;
  const transcribingIconBackgroundColor = isRecording
    ? colors.dangerSurface
    : colors.surfaceContainer;

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
    <IconButton
      icon={icon}
      onPress={onPress}
      disabled={disabled || isStreaming}
      size={20}
      color={active ? colors.ctaContentPrimary : colors.onSurface}
      backgroundColor={
        active ? colors.ctaSurfacePrimary : colors.surfaceContainer
      }
      accessibilityLabel={accessibilityLabel}
      style={styles.iconButtonSpacing}
    />
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
        disabled={disabled}
        size={20}
        color={active ? colors.ctaContentPrimary : colors.onSurface}
        backgroundColor={
          active ? colors.ctaSurfacePrimary : colors.surfaceContainer
        }
        accessibilityLabel={accessibilityLabel}
      />
      <Pressable onPress={onPress}>
        <Text
          variant="body2"
          style={[styles.attachLabel, { color: colors.onSurface }]}
        >
          {label}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={styles.mainContainer} onLayout={handleLayout}>
      {messageStarters}
      {expanded && (
        <Card
          style={[
            styles.attachOptionsList,
            isLiquidGlassSupported ? styles.glassCard : extraStyle,
          ]}
        >
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
        </Card>
      )}
      <View
        ref={composerRef}
        onLayout={onComposerLayout}
        style={[
          styles.inputFieldContainer,
          style,
          !isLiquidGlassSupported && { backgroundColor: colors.surface },
        ]}
      >
        {isLiquidGlassSupported ? (
          <LinearGradient
            pointerEvents="none"
            colors={bottomFadeColors[theme]}
            locations={BOTTOM_FADE_LOCATIONS}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.bottomFade}
          />
        ) : (
          <LinearGradient
            pointerEvents="none"
            colors={gradientColors[theme]}
            start={{ x: 0, y: 0 }}
            end={{ x: 0, y: 1 }}
            style={styles.topGradient}
          />
        )}
        <Card
          style={[
            styles.inputBarContainer,
            isLiquidGlassSupported ? styles.glassCard : inputBarStyle,
          ]}
        >
          <TextInput
            key={inputKey}
            autoFocus={focused}
            style={[styles.textInput, { color: colors.onSurface }]}
            placeholder={t('components.inputBar.placeholder')}
            placeholderTextColor="#999"
            value={value}
            editable={!disabled}
            onChangeText={handleChangeText}
            onFocus={handleFocus}
            onBlur={handleBlur}
            multiline
          />
          <View style={styles.inputBarContainerBottomPart}>
            <View style={styles.inputBarContainerBottomPartLeft}>
              <View style={styles.attachMainContainer}>
                {showAttachButton &&
                  renderAttachButton({
                    icon: attachButtonIcon,
                    active: !expanded && hasAttachment,
                    onPress: toggleAttach,
                    accessibilityLabel: attachButtonAccessibilityLabel,
                  })}
              </View>

              {showDictation &&
                (!isStreaming || isRecording || isTranscribing) &&
                (isTranscribing ? (
                  <View style={styles.transcriptionLoaderContainer}>
                    <ActivityIndicator size="small" color={colors.onSurface} />
                  </View>
                ) : (
                  <IconButton
                    icon={transcribingIconButton}
                    onPress={isRecording ? onStopDictation : onStartDictation}
                    disabled={disabled}
                    size={20}
                    color={transcribingIconColor}
                    backgroundColor={transcribingIconBackgroundColor}
                    accessibilityLabel={transcribingIconAccessibilityLabel}
                    style={styles.iconButtonSpacing}
                  />
                ))}
              {showWebSearch && (
                <IconButton
                  icon={{ iosIconName: 'globe', androidIconName: 'language' }}
                  onPress={() => {
                    haptics.light();
                    onToggleWebSearch?.();
                  }}
                  disabled={disabled}
                  size={20}
                  color={
                    webSearchEnabled
                      ? colors.ctaContentPrimary
                      : colors.onSurface
                  }
                  backgroundColor={
                    webSearchEnabled
                      ? colors.ctaSurfacePrimary
                      : colors.surfaceContainer
                  }
                  accessibilityLabel={t('components.inputBar.webSearch')}
                  accessibilityState={{ selected: webSearchEnabled }}
                  testID="web-search-toggle"
                  style={styles.iconButtonSpacing}
                />
              )}
              <IconButton
                icon={voiceAssistantIconButton}
                onPress={openVoiceAssistant}
                disabled={disabled}
                size={20}
                color={colors.onSurface}
                backgroundColor={colors.surfaceContainer}
                accessibilityLabel={t('components.inputBar.voiceAssistant')}
              />
            </View>
            <InputBarAction
              isStreaming={isStreaming}
              disabled={disabled}
              value={value}
              onSend={handleSend}
              onStop={onStop}
            />
          </View>
        </Card>
      </View>
    </View>
  );
};

const GlassCard: React.FC<React.ComponentProps<typeof View>> = props => {
  const theme = useTheme();

  return <LiquidGlassView colorScheme={theme} {...props} />;
};

// Memoized: ChatScreen re-renders on every streamed token, and none of that
// reaches the bar — its props keep their identity for the length of a turn.
export const InputBar = React.memo(InputBarView);

interface InputBarActionProps {
  isStreaming: boolean;
  disabled: boolean;
  value: string;
  onSend: () => void;
  onStop: () => void;
}

const InputBarAction: React.FC<InputBarActionProps> = ({
  isStreaming,
  disabled,
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
      disabled={disabled}
      size={20}
      color={color}
      backgroundColor={backgroundColor}
    />
  );
};
