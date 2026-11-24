import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  copyToClipboard,
  log,
  getMarkdownStyle,
  haptics,
  openExternalUrl,
  parseThinking,
} from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import {
  PRESENT_CHOICES_TOOL,
  attributeSourcesByBlock,
  stripCitations,
  useWebSearchStore,
} from 'services';
import { DisplayMessage } from 'types';

import { AnswerBody } from './AnswerBody';
import { AudioSpeakerButton } from './AudioSpeakerButton';
import { ChoiceButtons } from './ChoiceButtons';
import { ThinkingBlock } from './ThinkingBlock';
import { ThinkingModal } from './ThinkingModal';
import { ToolCallBlock } from './ToolCallBlock';
import { ToolCallModal } from './ToolCallModal';
import { WebSearchBlock, WebSourcesSheet } from './WebSearch';

import { PlatformIcon } from '../../PlatformIcon/PlatformIcon';
import { ShimmerText } from '../../ShimmerText/ShimmerText';
import { Text } from '../../Text/Text';

import styles from './AssistantMessage.styles';

const COPIED_RESET_MS = 1000;
const THINKING_FONT_SIZE = 14;

const EMPTY_WEB_SOURCES: NonNullable<DisplayMessage['webSources']> = [];

const formatDuration = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface AssistantMessageProps {
  message: DisplayMessage;
  isStreaming: boolean;
  messageId: string;
  canPlayAudio: boolean;
  isAudioLoading: boolean;
  isAudioPlaying: boolean;
  onPlayAudio?: (messageId: string, text: string) => void;
  onStopAudio?: () => void;
  onSendText?: (text: string) => void;
}

const AssistantMessageComponent: React.FC<AssistantMessageProps> = ({
  message,
  isStreaming,
  messageId,
  canPlayAudio,
  isAudioLoading,
  isAudioPlaying,
  onPlayAudio,
  onStopAudio,
  onSendText,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const { content, tokensPerSecond, timeToFirstToken, webSearchMs } = message;
  const toolInvocations = message.toolInvocations ?? [];
  const webSources = message.webSources ?? EMPTY_WEB_SOURCES;
  const isSearchingWeb = useWebSearchStore(
    state => isStreaming && state.isSearchingWeb,
  );

  const [copied, setCopied] = useState(false);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [openToolIndex, setOpenToolIndex] = useState<number | null>(null);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const seenChoiceKeys = useRef<Set<string>>(new Set());

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  const {
    thinking,
    rest: rawRest,
    isThinkingComplete,
  } = useMemo(() => parseThinking(content), [content]);

  const hasWebSources = webSources.length > 0;
  const rest = useMemo(
    () => (hasWebSources ? stripCitations(rawRest) : rawRest),
    [hasWebSources, rawRest],
  );

  const attributedBlocks = useMemo(() => {
    if (isStreaming || !hasWebSources) {
      return null;
    }

    const blocks = attributeSourcesByBlock(rawRest, webSources);

    return blocks.some(block => block.source !== null) ? blocks : null;
  }, [isStreaming, hasWebSources, rawRest, webSources]);

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = useCallback(() => {
    try {
      if (rest === '') {
        return;
      }
      copyToClipboard(rest);
      haptics.medium();
      setCopied(true);
    } catch (error) {
      log('handleCopy copy error ', error);
    }
  }, [rest]);

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    openExternalUrl(url);
  }, []);

  const metrics: string[] = [];

  if (!isStreaming && typeof webSearchMs === 'number') {
    metrics.push(
      t('components.messageListItem.searchTime', {
        time: formatDuration(webSearchMs),
      }),
    );
  }

  if (typeof tokensPerSecond === 'number') {
    metrics.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  }

  if (typeof timeToFirstToken === 'number') {
    metrics.push(formatDuration(timeToFirstToken));
  }

  const accentColor = copied ? colors.primary : colors.onSurfaceVariant;
  const isAwaitingResponse =
    isStreaming &&
    !isSearchingWeb &&
    content.length === 0 &&
    toolInvocations.length === 0;
  const isThinkingActive = isStreaming && !isThinkingComplete;
  const canCopyAssistantText = !isStreaming && rest !== '';

  const showAudioSpeaker = canPlayAudio && !isStreaming && rest.length > 0;

  const showSourcesButton = !isStreaming && hasWebSources;

  const showFooter =
    canCopyAssistantText ||
    showSourcesButton ||
    showAudioSpeaker ||
    metrics.length > 0;

  return (
    <View style={styles.assistantContainer}>
      <WebSearchBlock live={isStreaming} sources={webSources} />
      {isAwaitingResponse ? (
        <View style={styles.thinkingContainer}>
          <PlatformIcon
            iosIconName="sparkles"
            androidIconName="star_shine"
            size={THINKING_FONT_SIZE}
            color={colors.onSurfaceVariant}
          />
          <ShimmerText
            text={t('components.messageListItem.thinking')}
            fontSize={THINKING_FONT_SIZE}
          />
        </View>
      ) : (
        <>
          {thinking !== null && (
            <ThinkingBlock
              thinking={thinking}
              active={isThinkingActive}
              onPress={() => setThinkingOpen(true)}
            />
          )}
          {toolInvocations.map((invocation, toolIndex) => {
            // Small local models sometimes emit the same choices twice in one
            // turn; collapse the duplicate rows so the same tap doesn't look
            // like two buttons.
            if (invocation.name === PRESENT_CHOICES_TOOL) {
              const choices = Array.isArray(invocation.arguments.choices)
                ? (invocation.arguments.choices as string[])
                : [];
              const key = JSON.stringify(choices);
              const alreadyShown = seenChoiceKeys.current.has(key);
              seenChoiceKeys.current.add(key);
              if (alreadyShown) {
                return null;
              }
              return (
                <ChoiceButtons
                  key={`${invocation.name}-${toolIndex}`}
                  choices={choices}
                  onSendText={text => onSendText?.(text)}
                />
              );
            }
            return (
              <ToolCallBlock
                key={`${invocation.name}-${toolIndex}`}
                name={invocation.name}
                arguments={invocation.arguments}
                onPress={() => setOpenToolIndex(toolIndex)}
              />
            );
          })}
          <AnswerBody
            text={rest}
            isStreaming={isStreaming}
            blocks={attributedBlocks}
            markdownStyle={markdownStyle}
            onLinkPress={handleLinkPress}
          />
        </>
      )}
      {isStreaming && message.refining && (
        <View style={styles.refiningContainer}>
          <PlatformIcon
            iosIconName="text.magnifyingglass"
            androidIconName="manage_search"
            size={THINKING_FONT_SIZE}
            color={colors.onSurfaceVariant}
          />
          <ShimmerText
            text={t('components.messageListItem.refining')}
            fontSize={THINKING_FONT_SIZE}
          />
        </View>
      )}
      {showFooter && (
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
          {showSourcesButton && (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('components.messageListItem.showSources')}
              hitSlop={8}
              onPress={() => {
                haptics.light();
                setSourcesOpen(true);
              }}
              style={({ pressed }) => [pressed && styles.buttonPressed]}
              testID="web-sources-button"
            >
              <PlatformIcon
                iosIconName="book"
                androidIconName="menu_book"
                size={16}
                color={colors.onSurfaceVariant}
              />
            </Pressable>
          )}
          {showAudioSpeaker && (
            <AudioSpeakerButton
              isLoading={isAudioLoading}
              isPlaying={isAudioPlaying}
              messageId={messageId}
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
      {showSourcesButton && (
        <WebSourcesSheet
          sources={webSources}
          visible={sourcesOpen}
          onClose={() => setSourcesOpen(false)}
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

export const AssistantMessage = React.memo(AssistantMessageComponent);
