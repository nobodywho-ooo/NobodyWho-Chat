import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AssistantConfig } from 'database';
import { languageCode, listVoiceStyles } from 'helpers';
import { useCurrentTtsModel, useStyled } from 'hooks';
import { SelectablePill, Text } from 'components';

import styles from './SupertonicPreferences.styles';

interface SupertonicPreferencesProps {
  voice?: string;
  language?: string;
  onChange: (patch: Partial<AssistantConfig>) => void;
}

export const SupertonicPreferences: React.FC<SupertonicPreferencesProps> = ({
  voice,
  language,
  onChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const currentTtsModel = useCurrentTtsModel();

  const voices = useMemo(
    () =>
      currentTtsModel !== undefined &&
      currentTtsModel.family.toLowerCase() === 'supertonic'
        ? listVoiceStyles(currentTtsModel.id)
        : [],
    [currentTtsModel],
  );

  if (
    currentTtsModel === undefined ||
    currentTtsModel.family.toLowerCase() !== 'supertonic'
  ) {
    return null;
  }

  const languages =
    currentTtsModel.languages.length > 0
      ? currentTtsModel.languages
      : ['English'];

  const voiceLabel = (code: string) => {
    const index = code.slice(1);
    if (code.startsWith('F')) {
      return t('screens.customizeAssistant.voiceFemale', { index });
    }
    if (code.startsWith('M')) {
      return t('screens.customizeAssistant.voiceMale', { index });
    }
    return code;
  };

  return (
    <View>
      <Text bold style={styles.sectionHeader}>
        {t('screens.customizeAssistant.voice')}
      </Text>
      <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
        {t('screens.customizeAssistant.voiceSubtitle')}
      </Text>
      <View style={styles.pillRow}>
        {voices.map(code => (
          <SelectablePill
            key={code}
            label={voiceLabel(code)}
            selected={code === voice}
            onPress={() => onChange({ ttsVoice: code })}
          />
        ))}
      </View>

      <Text bold style={styles.sectionHeader}>
        {t('screens.customizeAssistant.language')}
      </Text>
      <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
        {t('screens.customizeAssistant.languageSubtitle')}
      </Text>
      <View style={styles.pillRow}>
        {languages.map(name => {
          const code = languageCode(name);
          return (
            <SelectablePill
              key={name}
              label={name}
              selected={code === language}
              onPress={() => onChange({ ttsLanguage: code })}
            />
          );
        })}
      </View>
    </View>
  );
};
