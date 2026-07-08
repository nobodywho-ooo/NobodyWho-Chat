import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  Image,
  Linking,
  Pressable,
  View,
} from 'react-native';
import { useTranslation } from 'react-i18next';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { StreamdownText } from 'react-native-streamdown';
import {
  copyToClipboard,
  log,
  getMarkdownStyle,
  haptics,
  messageDocumentKind,
  messageDocumentName,
  messageDocumentUri,
  parseThinking,
  stripThinkingBlocks,
} from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { DisplayMessage } from 'types';
import { AudioAttachment } from './AudioAttachment';
import { FullScreenImageModal } from './FullScreenImageModal';
import { SystemBlock } from './SystemBlock';
import { ThinkingBlock } from './ThinkingBlock';
import { ThinkingModal } from './ThinkingModal';
import { ToolCallBlock } from './ToolCallBlock';
import { ToolCallModal } from './ToolCallModal';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

const COPIED_RESET_MS = 1500;

const formatTimeToFirstToken = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface MessageListItemProps {
  message: DisplayMessage;
  isStreaming?: boolean;
}

const MessageListItem: React.FC<MessageListItemProps> = ({
  message,
  isStreaming = false,
}) => {
  const { t } = useTranslation();
  const { content, role, tokensPerSecond, timeToFirstToken } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const [copied, setCopied] = useState(false);
  const [playingAudio, setPlayingAudio] = useState(false);
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const [thinkingOpen, setThinkingOpen] = useState(false);
  const [openToolIndex, setOpenToolIndex] = useState<number | null>(null);
  const documentsPath = message.documentsPath ?? [];
  const toolInvocations = message.toolInvocations ?? [];

  const renderAttachedFiles = () => {
    if (documentsPath.length === 0) {
      return null;
    }

    const images: string[] = [];
    const audios: string[] = [];
    const files: string[] = [];

    documentsPath.forEach(path => {
      const kind = messageDocumentKind(path);
      if (kind === 'image') {
        images.push(path);
      } else if (kind === 'audio') {
        audios.push(path);
      } else {
        files.push(path);
      }
    });

    return (
      <View style={styles.attachmentsContainer}>
        {images.length > 0 && (
          <View
            testID="message-attachment-images"
            style={styles.imagesContainer}
          >
            {images.map((path, index) => {
              const uri = messageDocumentUri(path);
              return (
                <Pressable
                  key={`image-${index}-${path}`}
                  accessibilityRole="button"
                  accessibilityLabel={t('components.messageListItem.viewImage')}
                  onPress={() => setFullScreenImage(uri)}
                  style={({ pressed }) => pressed && styles.imagePressed}
                >
                  <Image
                    source={{ uri }}
                    style={styles.imageAttachment}
                    resizeMode="cover"
                    accessibilityLabel={messageDocumentName(path)}
                  />
                </Pressable>
              );
            })}
          </View>
        )}
        {audios.length > 0 && (
          <View testID="message-attachment-audio" style={styles.audioContainer}>
            {audios.map((path, index) => (
              <AudioAttachment key={`audio-${index}-${path}`} path={path} />
            ))}
          </View>
        )}
        {files.map((path, index) => (
          <Text
            key={`file-${index}-${path}`}
            variant="caption"
            style={[styles.attachmentName, { color: colors.onSurfaceVariant }]}
          >
            {messageDocumentName(path)}
          </Text>
        ))}
        <FullScreenImageModal
          uri={fullScreenImage}
          onClose={() => setFullScreenImage(null)}
        />
      </View>
    );
  };

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

  const handleCopyUser = useCallback(() => {
    try {
      if (content === '') {
        return;
      }
      copyToClipboard(content);
      haptics.medium();
    } catch (error) {
      log('handleCopyUser copy error ', error);
    }
  }, [content]);

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

  const handlePlayAudio = useCallback(() => {
    try {
      setPlayingAudio(true);
      const delay = (ms: number) =>
        new Promise(() => setTimeout(() => setPlayingAudio(false), ms));
      delay(2000);
      haptics.medium();
    } catch (error) {
      setPlayingAudio(false);
      log('handleCopy copy error ', error);
    }
  }, []);

  const handleLinkPress = useCallback(({ url }: { url: string }) => {
    Linking.openURL(url).catch(error =>
      log(`Failed to open URL ${url}`, error),
    );
  }, []);

  if (role === 'user') {
    return (
      <View style={styles.userContainer}>
        {renderAttachedFiles()}
        {content.length > 0 && (
          <Pressable
            onLongPress={handleCopyUser}
            style={({ pressed }) => [
              styles.userBubbleContainer,
              { backgroundColor: colors.surfaceContainer },
              pressed && styles.userBubblePressed,
            ]}
          >
            <Text style={styles.text}>{content}</Text>
          </Pressable>
        )}
      </View>
    );
  } else if (role === 'assistant') {
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
    const canPlayAudio = !isStreaming; // TODO: update when ready

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
            {toolInvocations.map((invocation, index) => (
              <ToolCallBlock
                key={`${invocation.name}-${index}`}
                name={invocation.name}
                arguments={invocation.arguments}
                onPress={() => setOpenToolIndex(index)}
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
            {canPlayAudio && (
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('components.messageListItem.playAudio')}
                hitSlop={8}
                onPress={handlePlayAudio}
                style={({ pressed }) => [pressed && styles.buttonPressed]}
              >
                <PlatformIcon
                  iosIconName={playingAudio ? 'pause' : 'speaker.wave.2'}
                  androidIconName={playingAudio ? 'pause' : 'volume_up'}
                  size={16}
                  color={accentColor}
                />
              </Pressable>
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
  } else if (role === 'system') {
    return (
      <View style={styles.assistantContainer}>
        <SystemBlock content={content} />
      </View>
    );
  }

  return null;
};

export { MessageListItem };
