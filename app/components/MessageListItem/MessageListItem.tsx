import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, View } from 'react-native';
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
} from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { DisplayMessage } from 'types';
import { AudioAttachment } from './AudioAttachment';
import { FullScreenImageModal } from './FullScreenImageModal';
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
  const [fullScreenImage, setFullScreenImage] = useState<string | null>(null);
  const documentsPath = message.documentsPath ?? [];

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

  useEffect(() => {
    if (!copied) {
      return;
    }
    const timeout = setTimeout(() => setCopied(false), COPIED_RESET_MS);
    return () => clearTimeout(timeout);
  }, [copied]);

  const handleCopy = useCallback(() => {
    try {
      copyToClipboard(content);
      haptics.selection();
      setCopied(true);
    } catch (error) {
      log('MessageListItem copy error ', error);
    }
  }, [content]);

  if (role === 'user') {
    return (
      <View style={styles.userContainer}>
        {renderAttachedFiles()}
        {content.length > 0 && (
          <View
            style={[
              styles.userBubbleContainer,
              { backgroundColor: colors.surfaceContainer },
            ]}
          >
            <Text style={styles.text}>{content}</Text>
          </View>
        )}
      </View>
    );
  }

  const metrics: string[] = [];
  if (typeof tokensPerSecond === 'number') {
    metrics.push(`${tokensPerSecond.toFixed(1)} tok/s`);
  }
  if (typeof timeToFirstToken === 'number') {
    metrics.push(formatTimeToFirstToken(timeToFirstToken));
  }

  const accentColor = copied ? colors.primary : colors.onSurfaceVariant;
  const isAwaitingResponse = isStreaming && content.length === 0;

  return (
    <View style={styles.assistantContainer}>
      {isAwaitingResponse ? (
        <ActivityIndicator
          size="small"
          color={colors.primary}
          style={styles.loadingIndicator}
        />
      ) : isStreaming ? (
        <StreamdownText
          containerStyle={styles.streamdownContainer}
          markdown={content}
          markdownStyle={markdownStyle}
        />
      ) : (
        <EnrichedMarkdownText
          containerStyle={styles.streamdownContainer}
          markdown={content}
          markdownStyle={markdownStyle}
        />
      )}
      {content.length > 0 && (
        <View style={styles.footerContainer}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('components.messageListItem.copy')}
            hitSlop={8}
            onPress={handleCopy}
            style={({ pressed }) => [
              styles.copyButton,
              pressed && styles.copyButtonPressed,
            ]}
          >
            {!isStreaming && (
              <>
                <PlatformIcon
                  iosIconName={copied ? 'checkmark' : 'doc.on.doc'}
                  androidIconName={copied ? 'check' : 'content_copy'}
                  size={14}
                  color={accentColor}
                />
                <Text
                  variant="caption"
                  style={[styles.copyLabel, { color: accentColor }]}
                >
                  {t(
                    copied
                      ? 'components.messageListItem.copied'
                      : 'components.messageListItem.copy',
                  )}
                </Text>
              </>
            )}
          </Pressable>
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
    </View>
  );
};

export { MessageListItem };
