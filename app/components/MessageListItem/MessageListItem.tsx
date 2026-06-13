import React, { useMemo } from 'react';
import { View } from 'react-native';
import { StreamdownText } from 'react-native-streamdown';
import { getMarkdownStyle } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { DisplayMessage } from 'types';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

const formatTimeToFirstToken = (ms: number): string =>
  ms >= 1000 ? `${(ms / 1000).toFixed(1)} s` : `${Math.round(ms)} ms`;

interface MessageListItemProps {
  message: DisplayMessage;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ message }) => {
  const { content, role, tokensPerSecond, timeToFirstToken } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

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

  return (
    <View style={styles.assistantContainer}>
      <StreamdownText
        containerStyle={styles.streamdownContainer}
        markdown={content}
        markdownStyle={markdownStyle}
      />
      {metrics.length > 0 && (
        <Text
          variant="caption"
          style={[styles.metricsContainer, { color: colors.onSurfaceVariant }]}
        >
          {metrics.join(' · ')}
        </Text>
      )}
    </View>
  );
};

export { MessageListItem };
