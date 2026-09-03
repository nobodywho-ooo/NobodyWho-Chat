import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import type { VoiceAssistantStatus } from '../hooks';

interface VoiceSetupProps {
  status: VoiceAssistantStatus;
}

export const VoiceSetup: React.FC<VoiceSetupProps> = ({ status }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const renderChecklistRow = (loaded: boolean, label: string) => (
    <View style={styles.rowContainer}>
      <PlatformIcon
        iosIconName={loaded ? 'checkmark.circle.fill' : 'circle'}
        androidIconName={loaded ? 'check_circle' : 'radio_button_unchecked'}
        size={20}
        color={loaded ? colors.successSurface : colors.onSurfaceVariant}
      />
      <Text
        variant="body2"
        style={{
          color: loaded ? colors.onSurface : colors.onSurfaceVariant,
        }}
      >
        {label}
      </Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <Text variant="body1" bold style={styles.title}>
        {t('screens.voiceAssistant.setup.title')}
      </Text>
      <Text
        variant="body2"
        style={[styles.description, { color: colors.onSurfaceVariant }]}
      >
        {t('screens.voiceAssistant.setup.description')}
      </Text>
      <View style={styles.checklistContainer}>
        {renderChecklistRow(
          status.isChatReady,
          t('screens.voiceAssistant.setup.chat'),
        )}
        {renderChecklistRow(
          status.isSttReady,
          t('screens.voiceAssistant.setup.stt'),
        )}
        {renderChecklistRow(
          status.isTtsReady,
          t('screens.voiceAssistant.setup.tts'),
        )}
      </View>
      <Text
        variant="caption"
        style={[styles.hint, { color: colors.onSurfaceVariant }]}
      >
        {t('screens.voiceAssistant.setup.hint')}
      </Text>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacings.md,
    paddingHorizontal: Spacings.md,
  },
  title: {
    textAlign: 'center',
  },
  description: {
    textAlign: 'center',
  },
  checklistContainer: {
    gap: Spacings.sm,
    marginTop: Spacings.sm,
  },
  rowContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacings.sm,
  },
  hint: {
    textAlign: 'center',
    marginTop: Spacings.sm,
  },
});
