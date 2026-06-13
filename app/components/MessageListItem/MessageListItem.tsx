import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { StreamdownText } from 'react-native-streamdown';
import { copyToClipboard, devLog, getMarkdownStyle, haptics } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { DisplayMessage } from 'types';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

const COPIED_RESET_MS = 1500;

const formatTimeToFirstToken = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface MessageListItemProps {
  message: DisplayMessage;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ message }) => {
  const { t } = useTranslation();
  const { content, role, tokensPerSecond, timeToFirstToken } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();
  const [copied, setCopied] = useState(false);

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
      devLog('MessageListItem copy error ', error);
    }
  }, [content]);

  if (role === 'user') {
    return (
      <View
        style={[
          styles.userContainer,
          { backgroundColor: colors.surfaceContainer },
        ]}
      >
        <Text style={styles.text}>{content}</Text>
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

  return (
    <View style={styles.assistantContainer}>
      <StreamdownText
        containerStyle={styles.streamdownContainer}
        markdown={content}
        markdownStyle={markdownStyle}
      />
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
