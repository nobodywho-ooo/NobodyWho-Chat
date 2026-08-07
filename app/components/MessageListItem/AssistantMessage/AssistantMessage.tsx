import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Linking, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import {
  copyToClipboard,
  log,
  getMarkdownStyle,
  haptics,
  parseThinking,
  stripThinkingBlocks,
} from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { DisplayMessage } from 'types';

import { AudioSpeakerButton } from './AudioSpeakerButton';
import { ThinkingBlock } from './ThinkingBlock';
import { ThinkingModal } from './ThinkingModal';
import { ToolCallBlock } from './ToolCallBlock';
import { ToolCallModal } from './ToolCallModal';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { Text } from '../../Text/Text';

import styles from './AssistantMessage.styles';

const COPIED_RESET_MS = 1500;

const formatTimeToFirstToken = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface AssistantMessageProps {
  message: DisplayMessage;
  isStreaming: boolean;
  index: number;
  canPlayAudio: boolean;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  onPlayAudio?: (index: number, text: string) => void;
  onStopAudio?: () => void;
}

export const AssistantMessage: React.FC<AssistantMessageProps> = ({
  message,
  isStreaming,
  index,
  canPlayAudio,
  isAudioLoading,
  isAudioPlaying,
  onPlayAudio,
  onStopAudio,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const { content, tokensPerSecond, timeToFirstToken } = message;
  const toolInvocations = message.toolInvocations ?? [];

  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [openToolIndex, setOpenToolIndex] = useState<number | null>(null);

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  const { thinking, rest, isThinkingComplete } = useMemo(
    () => parseThinking(content),
    [content],
  );

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = useCallback(() => {
    try {
      const text = stripThinkingBlocks(content);
      if (text === '') {
        return;
      }
      copyToClipboard(text);
      haptics.medium();
      setCopied(true);
    } catch (error) {
      log('handleCopy copy error ', error);
    }
  }, [content]);

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );
  }, []);

  const metrics: string[] = [];
  if (typeof tokensPerSecond === 'number') {
    metrics.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (typeof timeToFirstToken === 'number') {
    metrics.push(formatTimeToFirstToken(timeToFirstToken));
  }

  const accentColor = copied ? colors.primary : colors.onSurfaceVariant;
  const isAwaitingResponse =
    isStreaming && content.length === 0 && toolInvocations.length === 0;
  const isThinkingActive = isStreaming && !isThinkingComplete;
  const canCopyAssistantText =
    stripThinkingBlocks(content) !== '' && !isStreaming;

  const showAudioSpeaker = canPlayAudio && !isStreaming && rest.length > 0;

  return (
    <View style={styles.assistantContainer}>
      {isAwaitingResponse ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.loadingIndicator}
        />
      ) : (
        <>
          {thinking !== null && (
            <ThinkingBlock
              thinking={thinking}
              active={isThinkingActive}
              onPress={() => setThinkingOpen(true)}
            />
          )}
          {toolInvocations.map((invocation, toolIndex) => (
            <ToolCallBlock
              key={`${invocation.name}-${toolIndex}`}
              name={invocation.name}
              arguments={invocation.arguments}
              onPress={() => setOpenToolIndex(toolIndex)}
            />
          ))}
          {rest.length > 0 &&
            (isStreaming ? (
              <StreamdownText
                containerStyle={styles.streamdownContainer}
                markdown={rest}
                markdownStyle={markdownStyle}
                onLinkPress={handleLinkPress}
              />
            ) : (
              <EnrichedMarkdownText
                containerStyle={styles.streamdownContainer}
                markdown={rest}
                markdownStyle={markdownStyle}
                onLinkPress={handleLinkPress}
              />
            ))}
        </>
      )}
      {content.length > 0 && (
        <View style={styles.footerContainer}>
          {canCopyAssistantText && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('components.messageListItem.copy')}
              hitSlop={8}
              onPress={handleCopy}
              style={({ pressed }) => [pressed && styles.buttonPressed]}
            >
              <PlatformIcon
                iosIconName={copied ? 'checkmark' : 'doc.on.doc'}
                androidIconName={copied ? 'check' : 'content_copy'}
                size={16}
                color={accentColor}
              />
            </Pressable>
          )}
          {showAudioSpeaker && (
            <AudioSpeakerButton
              isLoading={isAudioLoading}
              isPlaying={isAudioPlaying}
              index={index}
              content={rest}
              onPlay={onPlayAudio}
              onStop={onStopAudio}
            />
          )}
          {metrics.length > 0 && (
            <Text
              variant="caption"
              style={[styles.metricsText, { color: colors.onSurfaceVariant }]}
            >
              {metrics.join(' · ')}
            </Text>
          )}
        </View>
      )}
      {thinking !== null && (
        <ThinkingModal
          thinking={thinkingOpen ? thinking : null}
          active={isThinkingActive}
          onClose={() => setThinkingOpen(false)}
        />
      )}
      {openToolIndex !== null && toolInvocations[openToolIndex] && (
        <ToolCallModal
          name={toolInvocations[openToolIndex].name}
          arguments={toolInvocations[openToolIndex].arguments}
          result={toolInvocations[openToolIndex].result}
          visible
          onClose={() => setOpenToolIndex(null)}
        />
      )}
    </View>
  );
};
