import React, { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { AssistantConfig } from 'database';
import { ttsEngineForModel } from 'helpers';
import { useSlotModel, useStyled } from 'hooks';
import { ModelSlot } from 'types';

import { SelectablePill } from '../SelectablePill/SelectablePill';
import { Text } from '../Text/Text';

import styles from './VoicePreferences.styles';

interface VoicePreferencesProps {
  voice?: string;
  language?: string;
  onChange: (patch: Partial<AssistantConfig>) => void;
}

export const VoicePreferences: React.FC<VoicePreferencesProps> = ({
  voice,
  language,
  onChange,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const currentTtsModel = useSlotModel(ModelSlot.tts);

  // Voice and language are load-time options every engine takes, but each in
  // its own vocabulary, and only what the in-use model actually offers can be
  // picked (see ttsEngine.ts). Either list can be empty — pocket-tts keeps its
  // voice states outside the model folder — so each section renders only when
  // there is something to choose from, and the whole block disappears when
  // neither has.
  const engine =
    currentTtsModel === undefined
      ? undefined
      : ttsEngineForModel(currentTtsModel);

  const voices = useMemo(
    () => (currentTtsModel && engine ? engine.voices(currentTtsModel) : []),
    [currentTtsModel, engine],
  );

  const languages = useMemo(
    () => (currentTtsModel && engine ? engine.languages(currentTtsModel) : []),
    [currentTtsModel, engine],
  );

  if (voices.length === 0 && languages.length === 0) {
    return null;
  }

  // Supertonic presets are M1…M5/F1…F5, which read as "Male 1"/"Female 3";
  // every other engine names its voices ("bf_emma"), so show the code as-is.
  const voiceLabel = (code: string) => {
    const index = code.slice(1);
    if (/^F\d+$/.test(code)) {
      return t('screens.customizeAssistant.voiceFemale', { index });
    }
    if (/^M\d+$/.test(code)) {
      return t('screens.customizeAssistant.voiceMale', { index });
    }
    return code;
  };

  return (
    <>
      {voices.length > 0 && (
        <>
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
        </>
      )}

      {languages.length > 0 && (
        <>
          <Text bold style={styles.sectionHeader}>
            {t('screens.customizeAssistant.language')}
          </Text>
          <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
            {t('screens.customizeAssistant.languageSubtitle')}
          </Text>
          <View style={styles.pillRow}>
            {languages.map(option => (
              <SelectablePill
                key={option.code}
                label={option.name}
                selected={option.code === language}
                onPress={() => onChange({ ttsLanguage: option.code })}
              />
            ))}
          </View>
        </>
      )}
    </>
  );
};
