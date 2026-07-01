import React from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { ErrorView, ModelCard, PlatformIcon, Text } from 'components';
import { useStyled } from 'hooks';
import { Model } from 'types';
import { Spacings } from 'style';

import styles from './AvailableModels.styles';

interface AvailableModelsProps {
  models: Model[];
  isLoading: boolean;
  hasError: boolean;
  hasFetched: boolean;
  onModelPress: (model: Model) => void;
  onRetry: () => void;
  onInfoPress: () => void;
}

export const AvailableModels: React.FC<AvailableModelsProps> = ({
  models,
  isLoading,
  hasError,
  hasFetched,
  onModelPress,
  onRetry,
  onInfoPress,
}) => {
  const { t } = useTranslation();
  const { colors } = useStyled();

  const showModels = !isLoading && !hasError && models.length > 0;

  return (
    <>
      <View style={styles.headerContainer}>
        <Text variant="h4">{t('screens.models.availableToDownload')}</Text>
        <Pressable
          onPress={onInfoPress}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('screens.models.chooseModelTitle')}
        >
          <PlatformIcon
            iosIconName="info.circle"
            androidIconName="info"
            size={20}
            color={colors.primary}
          />
        </Pressable>
      </View>

      {isLoading && (
        <ActivityIndicator
          style={styles.loader}
          color={colors.onSurfaceVariant}
        />
      )}

      {hasError && (
        <ErrorView
          message={t('screens.models.errorCannotGetModelsAtTheMoment')}
          onRetry={onRetry}
          paddingVertical={Spacings.md}
          alignLeft
        />
      )}

      {showModels &&
        models.map(model => (
          <ModelCard key={model.id} model={model} onPress={onModelPress} />
        ))}

      {hasFetched && !hasError && models.length === 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}
    </>
  );
};
