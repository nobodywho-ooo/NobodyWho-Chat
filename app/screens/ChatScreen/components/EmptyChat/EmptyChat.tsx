import React from 'react';
import { View } from 'react-native';
import { useStyled } from 'hooks';
import { PlatformIcon, Text } from 'components';

import styles from './EmptyChat.styles';

export const EmptyChat: React.FC = () => {
  const { colors } = useStyled();

  return (
    <View style={styles.container}>
      <PlatformIcon
        iosIconName="bubble.fill"
        androidIconName="chat_bubble"
        size={48}
        color={colors.onSurfaceVariant}
      />
      <Text style={[styles.text, { color: colors.onSurfaceVariant }]}>
        Start a chat
      </Text>
    </View>
  );
};
