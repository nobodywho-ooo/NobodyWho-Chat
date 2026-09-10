import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import {
  ErrorView,
  ModelCard,
  PlatformIcon,
  SelectablePill,
  Text,
} from 'components';
import { useStyled } from 'hooks';
import { getPipelineIcon } from 'helpers';
import { Model, ModelPipeline, pipelineLabel } from 'types';
import { Spacings } from 'style';

import styles from './AvailableModels.styles';

const ALL_PIPELINES = 'all';

type PipelineFilter = ModelPipeline | typeof ALL_PIPELINES;

const UNORDERED = Number.MAX_SAFE_INTEGER;

const byCatalogueOrder = (a: Model, b: Model) =>
  (a.order ?? UNORDERED) - (b.order ?? UNORDERED);

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

  const [filter, setFilter] = useState<PipelineFilter>(ALL_PIPELINES);

  const pipelines = useMemo(() => {
    const present = new Set(models.map(model => model.pipeline));
    return Object.values(ModelPipeline).filter(pipeline =>
      present.has(pipeline),
    );
  }, [models]);

  // Fall back to All filter when downloading the last model of a selected pipeline
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

      {showFilters && (
        <View style={styles.filterContainer}>
          <SelectablePill
            label={t('screens.models.allPipelines')}
            selected={filter === ALL_PIPELINES}
            onPress={() => setFilter(ALL_PIPELINES)}
          />
          {pipelines.map(pipeline => (
            <SelectablePill
              key={pipeline}
              label={pipelineLabel[pipeline]}
              icon={getPipelineIcon(pipeline)}
              selected={filter === pipeline}
              onPress={() => setFilter(pipeline)}
            />
          ))}
        </View>
      )}

      {showModels &&
        visibleModels.map(model => (
          <ModelCard key={model.id} model={model} onPress={onModelPress} />
        ))}

      {hasFetched && !hasError && models.length === 0 && (
        <Text>{t('screens.models.youHaveDownloadedAllTheModels')}</Text>
      )}
    </>
  );
};
