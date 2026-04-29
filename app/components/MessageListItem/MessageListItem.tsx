import React, { useMemo } from 'react';
import { View } from 'react-native';
import { EnrichedMarkdownText } from 'react-native-enriched-markdown';
import { ChatMessage, Role } from 'react-native-nobodywho';
import { getMarkdownStyle } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

interface MessageListItemProps {
  message: ChatMessage;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ message }) => {
  const { content, role } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  if (role == Role.User) {
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

  return (
    <EnrichedMarkdownText
      containerStyle={styles.assistantContainer}
      markdown={content}
      markdownStyle={markdownStyle}
    />
  );
};

export { MessageListItem };
