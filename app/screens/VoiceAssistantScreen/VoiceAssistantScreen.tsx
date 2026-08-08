import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { IconButton, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';

import styles from './VoiceAssistantScreen.styles';

interface VoiceAssistantScreenProps {
  onCloseDrawer: () => void;
}

export const VoiceAssistantScreen: React.FC<VoiceAssistantScreenProps> = ({
  onCloseDrawer,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <View style={styles.container}>
      <View style={styles.headerContainer}>
        <Text variant="h3" bold>
          {t('screens.voiceAssistant.title')}
        </Text>
        <IconButton
          icon={{ iosIconName: 'xmark', androidIconName: 'close' }}
          onPress={onCloseDrawer}
        />
      </View>

      <View style={styles.body}>
        <PlatformIcon
          iosIconName="mic"
          androidIconName="mic"
          size={64}
          color={colors.primary}
        />
        <Text variant="body1" bold style={styles.bodyTitle}>
          {t('screens.voiceAssistant.headline')}
        </Text>
        <Text
          variant="body2"
          style={[styles.bodyText, { color: colors.onSurfaceVariant }]}
        >
          {t('screens.voiceAssistant.description')}
        </Text>
      </View>
    </View>
  );
};
