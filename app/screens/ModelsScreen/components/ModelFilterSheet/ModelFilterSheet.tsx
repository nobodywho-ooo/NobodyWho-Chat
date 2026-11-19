import React from 'react';
import { Modal, Pressable, View } from 'react-native';
import Animated, { SlideInDown } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTranslation } from 'react-i18next';
import { Text } from 'components';
import { useStyled } from 'hooks';
import { ALL_PIPELINES_ICON, getPipelineIcon } from 'helpers';
import { ModelPipeline, pipelineLabel } from 'types';
import { Spacings } from 'style';

import { FilterOption } from './FilterOption';
import { styles } from './ModelFilterSheet.styles';

const SHEET_ENTER_MS = 260;

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
  const { colors } = useStyled();
  const insets = useSafeAreaInsets();

  const choose = (filter: PipelineFilter) => {
    onSelect(filter);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      navigationBarTranslucent
      onRequestClose={onClose}
    >
      <View style={styles.rootContainer}>
        <Pressable
          style={styles.backdropContainer}
          onPress={onClose}
          accessibilityRole="button"
          accessibilityLabel={t('common.cancel')}
          testID="model-filter-backdrop"
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
          testID="model-filter-sheet"
        >
          <Text variant="h3" bold style={styles.title}>
            {t('screens.models.filterModels')}
          </Text>
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
        </Animated.View>
      </View>
    </Modal>
  );
};
