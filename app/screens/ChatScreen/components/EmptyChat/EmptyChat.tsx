import React from 'react';
import { View } from 'react-native';
import { SFSymbol, MaterialSymbol } from '@react-navigation/native';
import { useStyled } from 'hooks';
import { isIOS } from 'helpers';
import { Text } from 'components';

import styles from './EmptyChat.styles';

export const EmptyChat: React.FC = () => {
  const { colors } = useStyled();

  return (
    <View style={styles.container}>
      {isIOS ? (
        <SFSymbol
          name="bubble.fill"
          size={48}
          color={colors.onSurfaceVariant}
        />
      ) : (
        <MaterialSymbol
          name="chat_bubble"
          size={48}
          color={colors.onSurfaceVariant}
        />
      )}
      <Text style={[styles.text, { color: colors.onSurfaceVariant }]}>
        Start a chat
      </Text>
    </View>
  );
};
