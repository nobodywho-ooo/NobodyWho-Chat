import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AssistantConfig } from 'database';
import { STT_LANGUAGE_OPTIONS } from 'helpers';
import { useSlotModel, useStyled } from 'hooks';
import { ModelSlot } from 'types';

import { SelectablePill } from '../SelectablePill/SelectablePill';
import { Text } from '../Text/Text';

import styles from './SpeechToTextPreferences.styles';

interface SpeechToTextPreferencesProps {
  language?: string;
  onChange: (patch: Partial<AssistantConfig>) => void;
}

export const SpeechToTextPreferences: React.FC<
  SpeechToTextPreferencesProps
> = ({ language, onChange }) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const currentSttModel = useSlotModel(ModelSlot.stt);

  if (currentSttModel === undefined) {
    return null;
  }

  return (
    <>
      <Text variant="h3" bold style={styles.blockHeader}>
        {t('screens.customizeAssistant.speechToText')}
      </Text>

      <Text bold style={styles.sectionHeader}>
        {t('screens.customizeAssistant.sttLanguage')}
      </Text>
      <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
        {t('screens.customizeAssistant.sttLanguageSubtitle')}
      </Text>
      <View style={styles.pillRow}>
        <SelectablePill
          label={t('screens.customizeAssistant.sttLanguageAutomatic')}
          selected={language === undefined}
          onPress={() => onChange({ sttLanguage: undefined })}
        />
        {STT_LANGUAGE_OPTIONS.map(option => (
          <SelectablePill
            key={option.code}
            label={option.name}
            selected={option.code === language}
            onPress={() => onChange({ sttLanguage: option.code })}
          />
        ))}
      </View>
    </>
  );
};
