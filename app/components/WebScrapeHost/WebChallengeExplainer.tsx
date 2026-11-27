import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';

import { Button } from '../Button/Button';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Sheet } from '../Sheet/Sheet';
import { Text } from '../Text/Text';

import styles from './WebChallengeExplainer.styles';

const ICON_SIZE = 28;

interface WebChallengeExplainerProps {
  visible: boolean;
  onContinue: () => void;
  onSkip: () => void;
}

export const WebChallengeExplainer: React.FC<WebChallengeExplainerProps> = ({
  visible,
  onContinue,
  onSkip,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  return (
    <Sheet
      visible={visible}
      onClose={onSkip}
      closeLabel={t('components.webChallenge.skip')}
      testID="web-challenge-explainer"
    >
      <View style={styles.sheetContainer}>
        <View
          style={[
            styles.iconContainer,
            { backgroundColor: colors.surfaceContainer },
          ]}
        >
          <PlatformIcon
            iosIconName="checkmark.shield"
            androidIconName="verified_user"
            size={ICON_SIZE}
            color={colors.primary}
          />
        </View>
        <Text variant="h3" bold style={styles.centeredText}>
          {t('components.webChallenge.title')}
        </Text>
        <Text
          variant="body1"
          style={[styles.centeredText, { color: colors.onSurfaceVariant }]}
        >
          {t('components.webChallenge.why')}
        </Text>
        <Text
          variant="body2"
          style={[styles.centeredText, { color: colors.onSurfaceVariant }]}
        >
          {t('components.webChallenge.privacy')}
        </Text>
        <View style={styles.actionsContainer}>
          <Button
            title={t('components.webChallenge.continue')}
            onPress={onContinue}
            testID="web-challenge-explainer-continue"
          />
          <Button
            variant="outline"
            title={t('components.webChallenge.skip')}
            onPress={onSkip}
            testID="web-challenge-explainer-skip"
          />
        </View>
      </View>
    </Sheet>
  );
};
