import React from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';

import { styles } from '../InputBar.styles';
import { FeatureButton } from './FeatureButton';

interface DictationButtonProps {
  available: boolean;
  isRecording: boolean;
  isTranscribing: boolean;
  isStreaming: boolean;
  disabled: boolean;
  onStart?: () => void;
  onStop?: () => void;
  onUnavailable?: (message: string) => void;
}

// Mic → stop while recording → spinner while transcribing. Disabled while an
// answer streams in; send is disabled while dictating, so the two never overlap.
export const DictationButton: React.FC<DictationButtonProps> = ({
  available,
  isRecording,
  isTranscribing,
  isStreaming,
  disabled,
  onStart,
  onStop,
  onUnavailable,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const handlePress = () => {
    if (isRecording) {
      onStop?.();
    } else {
      onStart?.();
    }
  };

  if (isTranscribing) {
    return (
      <View style={styles.transcriptionLoaderContainer}>
        <ActivityIndicator size="small" color={colors.onSurface} />
      </View>
    );
  }

  return (
    <FeatureButton
      icon={
        isRecording
          ? { iosIconName: 'stop.fill', androidIconName: 'stop' }
          : { iosIconName: 'mic', androidIconName: 'mic' }
      }
      accessibilityLabel={t(
        isRecording
          ? 'components.inputBar.stopDictation'
          : 'components.inputBar.dictate',
      )}
      active={isRecording}
      activeTone="danger"
      unavailable={!available}
      unavailableMessage={t('components.inputBar.dictationUnavailable')}
      onUnavailable={onUnavailable}
      disabled={disabled || isStreaming}
      onPress={handlePress}
      style={styles.iconButtonSpacing}
    />
  );
};
