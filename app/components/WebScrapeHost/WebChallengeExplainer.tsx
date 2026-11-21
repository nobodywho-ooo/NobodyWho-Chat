import React from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { useStyled } from 'hooks';
import { Spacings } from 'style';

import { Button } from '../Button/Button';
import { PlatformIcon } from '../PlatformIcon/PlatformIcon';
import { Text } from '../Text/Text';

const SHEET_ENTER_MS = 260;
const SHEET_RADIUS = 28;
const ICON_SIZE = 28;
const BACKDROP_OPACITY = 0.4;

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
  const insets = useSafeAreaInsets();

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onSkip}
    >
      <View style={styles.rootContainer}>
        <Pressable
          style={styles.backdropContainer}
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel={t('components.webChallenge.skip')}
          testID="web-challenge-explainer-backdrop"
        />
        <Animated.View
          entering={SlideInDown.duration(SHEET_ENTER_MS)}
          style={[
            styles.sheetContainer,
            {
              backgroundColor: colors.surface,
              paddingBottom: insets.bottom + Spacings.lg,
            },
          ]}
          testID="web-challenge-explainer"
        >
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
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  backdropContainer: {
    ...StyleSheet.absoluteFill,
    backgroundColor: `rgba(0, 0, 0, ${BACKDROP_OPACITY})`,
  },
  sheetContainer: {
    borderTopLeftRadius: SHEET_RADIUS,
    borderTopRightRadius: SHEET_RADIUS,
    paddingTop: Spacings.xxl,
    paddingHorizontal: Spacings.xl,
    alignItems: 'center',
    gap: Spacings.md,
  },
  iconContainer: {
    padding: Spacings.md,
    borderRadius: Spacings.xxl,
    marginBottom: Spacings.xs,
  },
  centeredText: {
    textAlign: 'center',
  },
  actionsContainer: {
    alignSelf: 'stretch',
    gap: Spacings.sm,
    marginTop: Spacings.md,
  },
});
