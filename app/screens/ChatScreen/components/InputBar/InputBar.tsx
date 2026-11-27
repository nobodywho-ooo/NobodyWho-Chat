import React, { useCallback, useState } from 'react';
import {
  View,
  type LayoutChangeEvent,
  TextInput,
  StyleProp,
  ViewStyle,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { isLiquidGlassSupported } from '@callstack/liquid-glass';
import { useStyled } from 'hooks';
import { IconButtonIconProps } from 'components';
import { haptics } from 'helpers';
import { Spacings } from 'style';

import { styles } from './InputBar.styles';
import { AttachTray, type ImageAttachSource } from './components/AttachTray';
import { ScrollEdgeFade } from './components/ScrollEdgeFade';
import { DictationButton } from './components/DictationButton';
import { FeatureButton } from './components/FeatureButton';
import { Card } from './components/GlassCard';
import { SendButton } from './components/SendButton';
import { useAttachTrayCollapse } from './hooks/useAttachTrayCollapse';
import { useDrawerSwipeExclusion } from './hooks/useDrawerSwipeExclusion';
import { useOpenVoiceAssistant } from './hooks/useOpenVoiceAssistant';
import { useSyncedInputValue } from './hooks/useSyncedInputValue';
import type { ChatColumn } from '../../hooks/useChatColumn';

export type { ImageAttachSource };

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
  column?: ChatColumn;
  canAttachImage?: boolean;
  canAttachAudio?: boolean;
  imageSource?: ImageAttachSource;
  hasAudio?: boolean;
  onAttachImage?: () => void;
  onAttachCamera?: () => void;
  onAttachAudio?: () => void;
  canDictate?: boolean;
  isRecording?: boolean;
  isTranscribing?: boolean;
  onStartDictation?: () => void;
  onStopDictation?: () => void;
  webSearchEnabled?: boolean;
  webSearchUnavailableMessage?: string;
  onToggleWebSearch?: () => void;
  canThink?: boolean;
  thinkingEnabled?: boolean;
  onToggleThinking?: () => void;
  onUnavailable?: (message: string) => void;
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
  column,
  canAttachImage = false,
  canAttachAudio = false,
  imageSource,
  hasAudio = false,
  onAttachImage,
  onAttachCamera,
  onAttachAudio,
  canDictate = false,
  isRecording = false,
  isTranscribing = false,
  onStartDictation,
  onStopDictation,
  webSearchEnabled = false,
  webSearchUnavailableMessage,
  onToggleWebSearch,
  canThink = false,
  thinkingEnabled = false,
  onToggleThinking,
  onUnavailable,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const [focused, setFocused] = useState(false);
  const { inputKey, handleChangeText } = useSyncedInputValue(
    value,
    onChangeText,
  );
  const handleLayout = useDrawerSwipeExclusion();
  const openVoiceAssistant = useOpenVoiceAssistant();

  const featuresDisabled = disabled || isStreaming;

  const canAttach = canAttachImage || canAttachAudio;
  const expanded = canAttach && attachExpanded;
  const hasImage = imageSource !== undefined;
  const hasAttachment = hasImage || hasAudio;

  const columnPadding = column && {
    paddingLeft: column.paddingLeft,
    paddingRight: column.paddingRight,
  };

  useAttachTrayCollapse({
    attachExpanded,
    canAttach,
    hasImage,
    hasAudio,
    onAttachExpandedChange,
  });

  const handleFocus = useCallback(() => {
    setFocused(true);
    onFocus?.();
  }, [onFocus]);

  const handleBlur = useCallback(() => {
    setFocused(false);
    onBlur?.();
  }, [onBlur]);

  const handleAttachPress = () => {
    haptics.medium();
    onAttachExpandedChange(!attachExpanded);
  };

  const handleThinkingPress = () => {
    haptics.medium();
    onToggleThinking?.();
  };

  const handleWebSearchPress = () => {
    haptics.medium();
    onToggleWebSearch?.();
  };

  const handleSend = () => {
    if (attachExpanded) {
      onAttachExpandedChange(false);
    }
    onSend();
  };

  let attachIcon: IconButtonIconProps = {
    iosIconName: 'plus',
    androidIconName: 'add',
  };

  if (expanded) {
    attachIcon = { iosIconName: 'xmark', androidIconName: 'close' };
  } else if (hasAttachment) {
    attachIcon = { iosIconName: 'paperclip', androidIconName: 'attach_file' };
  }

  return (
    <View style={styles.mainContainer} onLayout={handleLayout}>
      {messageStarters}
      {expanded && (
        <View style={columnPadding}>
          <AttachTray
            canAttachImage={canAttachImage}
            canAttachAudio={canAttachAudio}
            imageSource={imageSource}
            hasAudio={hasAudio}
            disabled={featuresDisabled}
            onAttachImage={onAttachImage}
            onAttachCamera={onAttachCamera}
            onAttachAudio={onAttachAudio}
            onUnavailable={onUnavailable}
          />
        </View>
      )}
      <View
        ref={composerRef}
        onLayout={onComposerLayout}
        style={[
          styles.inputFieldContainer,
          column && {
            paddingLeft: Spacings.md + column.paddingLeft,
            paddingRight: Spacings.md + column.paddingRight,
          },
          style,
          !isLiquidGlassSupported && { backgroundColor: colors.surface },
        ]}
      >
        <ScrollEdgeFade />
        <Card
          style={[
            styles.inputBarContainer,
            isLiquidGlassSupported
              ? styles.glassCard
              : [
                  styles.opaqueCard,
                  {
                    backgroundColor: colors.surface,
                    borderColor: focused ? colors.borderFocused : colors.border,
                  },
                ],
          ]}
        >
          <TextInput
            key={inputKey}
            autoFocus={focused && value !== ''}
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
                <FeatureButton
                  icon={attachIcon}
                  accessibilityLabel={t(
                    expanded
                      ? 'components.inputBar.closeAttach'
                      : 'components.inputBar.attach',
                  )}
                  active={!expanded && hasAttachment}
                  unavailable={!canAttach}
                  unavailableMessage={t(
                    'components.inputBar.attachUnavailable',
                  )}
                  onUnavailable={onUnavailable}
                  disabled={featuresDisabled}
                  onPress={handleAttachPress}
                  style={styles.iconButtonSpacing}
                />
              </View>
              <DictationButton
                available={canDictate}
                isRecording={isRecording}
                isTranscribing={isTranscribing}
                isStreaming={isStreaming}
                disabled={disabled}
                onStart={onStartDictation}
                onStop={onStopDictation}
                onUnavailable={onUnavailable}
              />
              <FeatureButton
                icon={{
                  iosIconName: 'lightbulb',
                  androidIconName: 'lightbulb',
                }}
                accessibilityLabel={t('components.inputBar.thinking')}
                active={thinkingEnabled}
                selected={thinkingEnabled}
                unavailable={!canThink}
                unavailableMessage={t(
                  'components.inputBar.thinkingUnavailable',
                )}
                onUnavailable={onUnavailable}
                disabled={featuresDisabled}
                onPress={handleThinkingPress}
                testID="thinking-toggle"
                style={styles.iconButtonSpacing}
              />
              <FeatureButton
                icon={{ iosIconName: 'globe', androidIconName: 'language' }}
                accessibilityLabel={t('components.inputBar.webSearch')}
                active={webSearchEnabled}
                selected={webSearchEnabled}
                unavailable={webSearchUnavailableMessage !== undefined}
                unavailableMessage={webSearchUnavailableMessage}
                onUnavailable={onUnavailable}
                disabled={featuresDisabled}
                onPress={handleWebSearchPress}
                testID="web-search-toggle"
                style={styles.iconButtonSpacing}
              />
              <FeatureButton
                icon={{
                  iosIconName: 'waveform',
                  androidIconName: 'graphic_eq',
                }}
                accessibilityLabel={t('components.inputBar.voiceAssistant')}
                disabled={featuresDisabled}
                onPress={openVoiceAssistant}
              />
            </View>
            <SendButton
              isStreaming={isStreaming}
              disabled={disabled || isRecording || isTranscribing}
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

// Memoized: ChatScreen re-renders on every streamed token, and none of that
// reaches the bar — its props keep their identity for the length of a turn.
export const InputBar = React.memo(InputBarView);
