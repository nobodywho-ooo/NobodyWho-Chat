import React from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Sheet, SheetHeader } from 'components';
import { ALL_PIPELINES_ICON, getPipelineIcon } from 'helpers';
import { ModelPipeline, pipelineLabel } from 'types';

import { FilterOption } from './FilterOption';
import { styles } from './ModelFilterSheet.styles';

export const ALL_PIPELINES = 'all';

export type PipelineFilter = ModelPipeline | typeof ALL_PIPELINES;

interface ModelFilterSheetProps {
  visible: boolean;
  pipelines: readonly ModelPipeline[];
  selected: PipelineFilter;
  onSelect: (filter: PipelineFilter) => void;
  onClose: () => void;
}

export const ModelFilterSheet: React.FC<ModelFilterSheetProps> = ({
  visible,
  pipelines,
  selected,
  onSelect,
  onClose,
}) => {
  const { t } = useTranslation();

  const choose = (filter: PipelineFilter) => {
    onSelect(filter);
    onClose();
  };

  return (
    <Sheet
      visible={visible}
      onClose={onClose}
      closeLabel={t('common.cancel')}
      showCloseButton={false}
      testID="model-filter-sheet"
    >
      <View style={styles.sheetContainer}>
        <SheetHeader
          title={t('screens.models.filterModels')}
          onClose={onClose}
          closeLabel={t('common.cancel')}
          closeTestID="model-filter-sheet-close"
        />
        <FilterOption
          label={t('screens.models.allPipelines')}
          icon={ALL_PIPELINES_ICON}
          selected={selected === ALL_PIPELINES}
          onPress={() => choose(ALL_PIPELINES)}
        />
        {pipelines.map(pipeline => (
          <FilterOption
            key={pipeline}
            label={pipelineLabel[pipeline]}
            icon={getPipelineIcon(pipeline)}
            selected={selected === pipeline}
            onPress={() => choose(pipeline)}
          />
        ))}
      </View>
    </Sheet>
  );
};
