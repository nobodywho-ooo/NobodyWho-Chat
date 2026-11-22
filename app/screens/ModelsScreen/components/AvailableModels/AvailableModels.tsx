import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ErrorView,
  IconButton,
  ModelCard,
  PlatformIcon,
  Text,
} from 'components';
import { useStyled } from 'hooks';
import { byCatalogueOrder } from 'helpers';
import { Model, ModelPipeline } from 'types';
import { Spacings } from 'style';

import {
  ALL_PIPELINES,
  ModelFilterSheet,
  type PipelineFilter,
} from '../ModelFilterSheet/ModelFilterSheet';
import styles from './AvailableModels.styles';

const FILTER_ICON = {
  iosIconName: 'line.3.horizontal.decrease',
  androidIconName: 'filter_list',
} as const;

interface AvailableModelsProps {
  models: Model[];
  isLoading: boolean;
  hasError: boolean;
  hasFetched: boolean;
  onModelPress: (model: Model) => void;
  onRetry: () => void;
  onInfoPress: () => void;
}

const AvailableModelsView: React.FC<AvailableModelsProps> = ({
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

  const [filter, setFilter] = useState<PipelineFilter>(ALL_PIPELINES);
  const [isFilterSheetOpen, setFilterSheetOpen] = useState(false);

  const pipelines = useMemo(() => {
    const present = new Set(models.map(model => model.pipeline));
    return Object.values(ModelPipeline).filter(pipeline =>
      present.has(pipeline),
    );
  }, [models]);

  useEffect(() => {
    if (filter !== ALL_PIPELINES && !pipelines.includes(filter)) {
      setFilter(ALL_PIPELINES);
    }
  }, [filter, pipelines]);

  const visibleModels = useMemo(
    () =>
      (filter === ALL_PIPELINES
        ? [...models]
        : models.filter(model => model.pipeline === filter)
      ).sort(byCatalogueOrder),
    [models, filter],
  );

  const showModels = !isLoading && !hasError && models.length > 0;
  const showFilters = showModels && pipelines.length > 1;

  return (
    <>
      <View style={styles.headerContainer}>
        <View>
          <Text variant="h4">{t('screens.models.availableToDownload')}</Text>
          <Pressable
            onPress={onInfoPress}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('screens.models.chooseModelTitle')}
            style={({ pressed }) => [styles.infoRow, pressed && styles.pressed]}
          >
            <PlatformIcon
              iosIconName="info.circle"
              androidIconName="info"
              size={14}
              color={colors.primary}
            />
            <Text variant="body2" style={{ color: colors.onSurfaceVariant }}>
              {t('screens.models.chooseModelTitle')}
            </Text>
          </Pressable>
        </View>
        {showFilters && (
          <IconButton
            icon={FILTER_ICON}
            color={filter === ALL_PIPELINES ? undefined : colors.primary}
            onPress={() => setFilterSheetOpen(true)}
            accessibilityRole="button"
            accessibilityLabel={t('screens.models.filterModels')}
          />
        )}
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
        visibleModels.map(model => (
          <ModelCard key={model.id} model={model} onPress={onModelPress} />
        ))}

      {hasFetched && !hasError && models.length === 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}

      <ModelFilterSheet
        visible={isFilterSheetOpen && showFilters}
        pipelines={pipelines}
        selected={filter}
        onSelect={setFilter}
        onClose={() => setFilterSheetOpen(false)}
      />
    </>
  );
};

export const AvailableModels = React.memo(AvailableModelsView);
