import React, { useCallback, useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { PlatformIcon } from 'components';
import { curatedOnboardingModels, ModelSetup } from 'helpers';
import { useStyled } from 'hooks';
import { canRerankWithEmbeddings } from 'services';
import { isEmbeddingPipeline } from 'types';

import { OnboardingScreenProps } from '../../Onboarding.types';
import { useOnboarding } from '../../hooks/useOnboarding';
import { useOnboardingHeader } from '../../hooks/useOnboardingHeader';
import { OnboardingCard } from '../OnboardingCard/OnboardingCard';
import { OnboardingStep } from '../OnboardingStep/OnboardingStep';

import styles from './VoiceChoice.styles';

const CHOICE_ICON_SIZE = 24;

export const VoiceChoice: React.FC<OnboardingScreenProps<'VoiceChoice'>> = ({
  navigation,
  route,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();
  const {
    chatModels,
    curatedModels: { availabilityOf, ramGB },
  } = useOnboarding();
  const { modelId } = route.params;

  useOnboardingHeader(navigation, false);

  const downloadSizeGB = useCallback(
    (setup: ModelSetup) => {
      const setupAvailability = availabilityOf(
        curatedOnboardingModels(modelId, setup),
      );

      return setupAvailability.kind === 'automatic'
        ? setupAvailability.sizeGB
        : 0;
    },
    [availabilityOf, modelId],
  );

  const offersSearchSetup = useCallback(
    (setup: ModelSetup) => {
      const searchAvailability = availabilityOf(
        curatedOnboardingModels(modelId, setup),
      );

      if (searchAvailability.kind !== 'automatic') {
        return false;
      }

      const embeddingModel = searchAvailability.models.find(({ pipeline }) =>
        isEmbeddingPipeline(pipeline),
      );
      const chatModel = chatModels.find(({ id }) => id === modelId);

      return canRerankWithEmbeddings(chatModel, embeddingModel, ramGB);
    },
    [availabilityOf, chatModels, modelId, ramGB],
  );

  const offersTextAndSearch = useMemo(
    () => offersSearchSetup('textAndSearch'),
    [offersSearchSetup],
  );
  const offersAllModels = useMemo(
    () => offersSearchSetup('allModels'),
    [offersSearchSetup],
  );
  const offersSearch = offersTextAndSearch || offersAllModels;

  const download = useCallback(
    (setup: ModelSetup) =>
      navigation.navigate('OnboardingDownload', { modelId, setup }),
    [navigation, modelId],
  );

  return (
    <OnboardingStep
      header={t('screens.onboarding.voiceHeader')}
      title={t(
        offersSearch
          ? 'screens.onboarding.modalityWithSearchTitle'
          : 'screens.onboarding.modalityTitle',
      )}
      subtitle={t(
        offersSearch
          ? 'screens.onboarding.modalityWithSearchSubtitle'
          : 'screens.onboarding.modalitySubtitle',
      )}
    >
      <OnboardingCard
        icon={
          <View style={styles.choiceIconContainer}>
            <PlatformIcon
              iosIconName="text.bubble"
              androidIconName="chat"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textOnly')}
        sizeGB={downloadSizeGB('textOnly')}
        small
        testID="onboarding-text-only-button"
        onPress={() => download('textOnly')}
      />
      <OnboardingCard
        icon={
          <View style={styles.choiceIconContainer}>
            <PlatformIcon
              iosIconName="waveform"
              androidIconName="graphic_eq"
              size={CHOICE_ICON_SIZE}
              color={colors.primary}
            />
          </View>
        }
        title={t('screens.onboarding.textAndVoice')}
        sizeGB={downloadSizeGB('textAndVoice')}
        small
        testID="onboarding-text-voice-button"
        onPress={() => download('textAndVoice')}
      />
      {offersTextAndSearch && (
        <OnboardingCard
          icon={
            <View style={styles.choiceIconContainer}>
              <PlatformIcon
                iosIconName="globe"
                androidIconName="language"
                size={CHOICE_ICON_SIZE}
                color={colors.primary}
              />
            </View>
          }
          title={t('screens.onboarding.textAndSearch')}
          sizeGB={downloadSizeGB('textAndSearch')}
          small
          testID="onboarding-text-search-button"
          onPress={() => download('textAndSearch')}
        />
      )}
      {offersAllModels && (
        <OnboardingCard
          icon={
            <View style={styles.choiceIconContainer}>
              <PlatformIcon
                iosIconName="square.stack.3d.up"
                androidIconName="layers"
                size={CHOICE_ICON_SIZE}
                color={colors.primary}
              />
            </View>
          }
          title={t('screens.onboarding.allModels')}
          sizeGB={downloadSizeGB('allModels')}
          small
          testID="onboarding-all-models-button"
          onPress={() => download('allModels')}
        />
      )}
    </OnboardingStep>
  );
};
