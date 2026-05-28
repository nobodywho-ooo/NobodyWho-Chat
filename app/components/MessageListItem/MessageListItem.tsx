import React, { useMemo } from 'react';
import { View } from 'react-native';
import { StreamdownText } from 'react-native-streamdown';
import { Message } from 'react-native-nobodywho';
import { getMarkdownStyle } from 'helpers';
import { useStyled, useThemeMode } from 'hooks';
import { Text } from '../Text/Text';

import styles from './MessageListItem.styles';

interface MessageListItemProps {
  message: Message;
}

const MessageListItem: React.FC<MessageListItemProps> = ({ message }) => {
  const { content, role } = message;
  const { colors } = useStyled();
  const { isDarkMode } = useThemeMode();

  const markdownStyle = useMemo(
    () => getMarkdownStyle(isDarkMode, colors.onSurface),
    [isDarkMode, colors.onSurface],
  );

  if (role == 'user') {
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
    <StreamdownText
      containerStyle={styles.assistantContainer}
      markdown={content}
      markdownStyle={markdownStyle}
    />
  );
};

export { MessageListItem };
