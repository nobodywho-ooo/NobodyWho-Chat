import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { PlatformIcon, Text } from 'components';

import styles from './EmptyChat.styles';

export const EmptyChat: React.FC = () => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <View style={styles.container}>
      <PlatformIcon
        iosIconName="bubble.fill"
        androidIconName="chat_bubble"
        size={48}
        color={colors.onSurfaceDisabled}
      />
      <Text style={[styles.text, { color: colors.onSurfaceVariant }]}>
        {t('components.emptyChat.startAChat')}
      </Text>
    </View>
  );
};
